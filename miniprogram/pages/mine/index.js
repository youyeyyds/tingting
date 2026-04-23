// mine/index.js
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    avatarUrl: '', // 头像URL（带时间戳刷新）
    maskedPhone: '', // 隐藏中间5位的手机号
    headlines: [],
    stats: {
      learnedCourses: 0,
      graduatedCourses: 0,
      finishedCount: 0,
      favoriteCount: 0,
      totalPlayCount: 0,
      totalStudyMinutes: 0,
      joinedMinutes: 0
    },
    studyTime: { days: 0, hours: 0, mins: 0 }, // 学习时长拆分
    joinedTime: { days: 0, hours: 0, mins: 0 }, // 加入听听拆分
    loading: false,
    refresherTriggered: false,
    loadTime: 0, // 横幅时间戳
    bannerSpeed: 5000 // 轮播速度
  },

  // 格式化分钟数，返回拆分后的对象
  formatMinutesToObj(minutes) {
    if (!minutes || minutes <= 0) return { days: 0, hours: 0, mins: 0 };
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    return { days, hours, mins };
  },

  // 刷新头像URL（添加时间戳避免缓存过期）
  refreshAvatarUrl(avatar) {
    if (!avatar) return '/icons/svg/avatar.svg';
    const t = this.data.loadTime;
    return avatar.includes('?') ? `${avatar}&t=${t}` : `${avatar}?t=${t}`;
  },

  // 计算隐藏手机号中间5位
  maskPhone(phone) {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d{5}(\d{3})/, '$1*****$2');
  },

  onLoad() {
    // 使用全局时间戳和数据缓存，保持图片稳定
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    const loadTime = app.globalData.bannerLoadTime;
    // 检查是否有缓存的横幅数据
    const cachedHeadlines = app.globalData.mineHeadlines || [];
    this.setData({
      loadTime: loadTime,
      headlines: cachedHeadlines
    });
    this.checkLoginStatus();
    // 只在首次加载（无缓存）时获取横幅数据
    if (cachedHeadlines.length === 0) {
      this.loadHeadlines();
    }
  },

  onShow() {
    this.checkLoginStatus();
    // 未登录时跳转到首页
    if (!this.data.isLoggedIn) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    // 重新获取用户信息（刷新头像临时URL）
    this.refreshUserInfo();
    // 切换页面时不重新加载，保持原有数据
    if (app.globalData.userId) {
      this.loadUserStats();
    }
  },

  // 重新获取用户信息（刷新头像临时URL）
  async refreshUserInfo() {
    if (!app.globalData.userId) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'userFunctions',
        data: {
          type: 'getUserInfo',
          userId: app.globalData.userId
        }
      });
      if (res.result.success) {
        const user = res.result.data;
        app.globalData.userInfo = user;
        wx.setStorageSync('userInfo', JSON.stringify(user));
        // 如果有avatarFileID，用客户端API获取新的临时URL
        if (user.avatarFileID && user.avatarFileID.startsWith('cloud://')) {
          try {
            const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: [user.avatarFileID] });
            if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].tempFileURL) {
              this.setData({
                userInfo: user,
                avatarUrl: tempUrlRes.fileList[0].tempFileURL,
                maskedPhone: this.maskPhone(user.phone)
              });
              return;
            }
          } catch (e) {
            console.error('客户端获取头像临时URL失败:', e);
          }
        }
        // 没有avatarFileID或获取失败，使用返回的avatarUrl
        this.setData({
          userInfo: user,
          avatarUrl: user.avatarUrl || '/icons/svg/avatar.svg',
          maskedPhone: this.maskPhone(user.phone)
        });
      }
    } catch (err) {
      console.error('刷新用户信息失败:', err);
    }
  },

  onRefresh() {
    // 更新全局横幅时间戳和清除所有横幅缓存，刷新图片（封面不变）
    const newLoadTime = Date.now();
    app.globalData.bannerLoadTime = newLoadTime;
    app.globalData.indexHeadlines = [];
    app.globalData.loginHeadlines = [];
    app.globalData.favoriteHeadlines = [];
    app.globalData.mineHeadlines = [];
    this.setData({ refresherTriggered: true, loadTime: newLoadTime, headlines: [] });
    this.checkLoginStatus();
    this.loadHeadlines();
    if (this.data.isLoggedIn && app.globalData.userId) {
      this.loadUserStatsAsync().then(() => {
        this.setData({ refresherTriggered: false });
      });
    } else {
      this.setData({ refresherTriggered: false });
    }
  },

  loadUserStatsAsync() {
    if (!app.globalData.userId) {
      return Promise.resolve();
    }

    return wx.cloud.callFunction({
      name: 'userFunctions',
      data: {
        type: 'getUserStats',
        userId: app.globalData.userId
      }
    })
    .then(res => {
      if (res.result.success) {
        const stats = res.result.data;
        const studyTime = this.formatMinutesToObj(stats.totalStudyMinutes || 0);
        const joinedTime = this.formatMinutesToObj(stats.joinedMinutes || 0);
        this.setData({
          stats: stats,
          studyTime: studyTime,
          joinedTime: joinedTime
        });
      }
    })
    .catch(err => {
      console.error('获取用户统计失败:', err);
    });
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'mine' }
    })
    .then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.fixImageUrl(h.image, 'banner')
        }));
        // 缓存到全局变量
        app.globalData.mineHeadlines = headlines;
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  // 固定图片URL，使用picsum的seed格式保证稳定但刷新时变化
  // 横幅图片使用 bannerLoadTime
  fixImageUrl(url, type = 'banner') {
    if (!url) return url;

    // 检查是否为固定图片（seed以fixed_开头），不替换时间戳
    if (url.match(/picsum\.photos\/seed\/fixed_/)) {
      return url; // 固定图片，直接返回
    }

    const loadTime = this.data.loadTime;

    // 检查URL是否已经包含时间戳格式的seed（如 123456_banner_xxx），说明已处理过
    if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_banner_/)) {
      // 已处理过，但时间戳可能变化，需要替换新的时间戳
      const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_banner_([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const oldTime = seedMatch[1];
        const originalSeed = seedMatch[2];
        const size = seedMatch[3];
        // 时间戳变化时才替换
        if (oldTime != loadTime) {
          const newSeed = `${loadTime}_banner_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }
        return url;
      }
    }

    // 处理 picsum.photos URL
    if (url.includes('picsum.photos')) {
      // 如果已经是seed格式（非时间戳格式），替换seed为时间戳+类型+原seed组合
      // 格式: https://picsum.photos/seed/course1/400/400
      const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const originalSeed = seedMatch[1]; // 如 "course1"
        const size = seedMatch[2]; // 如 "400/400" 或 "400"
        const newSeed = `${loadTime}_${type}_${originalSeed}`;
        return `https://picsum.photos/seed/${newSeed}/${size}`;
      }

      // 提取尺寸信息，支持两种格式：
      // 格式1: https://picsum.photos/800/300?random=1
      // 格式2: https://picsum.photos/400?random=1
      const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
      const randomMatch = url.match(/random=(\d+)/);

      if (sizeMatch) {
        const size = sizeMatch[1]; // 如 "800/300" 或 "400"
        const originalRandom = randomMatch ? randomMatch[1] : '0';
        // 组合时间戳+类型+原始random作为种子
        const seed = `${loadTime}_${type}_${originalRandom}`;
        return `https://picsum.photos/seed/${seed}/${size}`;
      }
    }

    // 其他URL添加时间戳防缓存
    return this.addTimestamp(url);
  },

  // 添加时间戳到URL
  addTimestamp(url) {
    if (!url) return url;
    const t = this.data.loadTime;
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  checkLoginStatus() {
    const { isLoggedIn, userInfo, userId } = app.globalData;
    const avatarUrl = userInfo?.avatarUrl || '/icons/svg/avatar.svg';
    const maskedPhone = userInfo?.phone ? this.maskPhone(userInfo.phone) : '';
    this.setData({
      isLoggedIn: isLoggedIn || false,
      userInfo: userInfo || null,
      avatarUrl: avatarUrl,
      maskedPhone: maskedPhone
    });
    if (!isLoggedIn && userId) {
      // 尝试从本地存储恢复登录状态
      const storedUserId = wx.getStorageSync('userId');
      const storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserId && storedUserInfo) {
        const parsedUserInfo = JSON.parse(storedUserInfo);
        app.globalData.isLoggedIn = true;
        app.globalData.userId = storedUserId;
        app.globalData.userInfo = parsedUserInfo;
        this.setData({
          isLoggedIn: true,
          userInfo: parsedUserInfo,
          avatarUrl: parsedUserInfo.avatarUrl || '/icons/svg/avatar.svg',
          maskedPhone: this.maskPhone(parsedUserInfo.phone)
        });
      }
    }
  },

  async loadUserStats() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'userFunctions',
        data: {
          type: 'getUserStats',
          userId: app.globalData.userId
        }
      });

      if (res.result.success) {
        const stats = res.result.data;
        const studyTime = this.formatMinutesToObj(stats.totalStudyMinutes || 0);
        const joinedTime = this.formatMinutesToObj(stats.joinedMinutes || 0);
        this.setData({
          stats: stats,
          studyTime: studyTime,
          joinedTime: joinedTime
        });
      }
    } catch (err) {
      console.error('获取用户统计失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  handleEdit() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  handleLogout() {
    // 标记退出登录，用于首页显示提示
    app.globalData.logoutFlag = true;

    // 停止播放器并清空播放状态
    app.bgAudioManager.stop();
    app.globalData.miniPlayerActive = false;
    app.globalData.miniPlayerIndexFadedIn = false;
    app.globalData.playingCourse = null;
    app.globalData.playingChapter = null;
    app.globalData.playingIndex = 0;
    app.globalData.playlistChaptersData = [];
    app.globalData.playMode = 'sequence';
    app.globalData.playlistSortOrder = 'asc';
    // 通知 mini-player 关闭
    app.notifyCallbacks('onClose', {});

    app.globalData.isLoggedIn = false;
    app.globalData.userInfo = null;
    app.globalData.userId = null;
    wx.removeStorageSync('userId');
    wx.removeStorageSync('userInfo');

    // 跳转到首页（清空页面栈）
    wx.reLaunch({ url: '/pages/index/index' });
  },

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0分钟';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    }
    return `${mins}分钟`;
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index == 2) return; // 当前页，不做处理
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    if (index == 0) {
      // 点击首页，返回上一页（首页）
      wx.navigateBack();
    } else {
      // 点击收藏，替换当前页
      wx.redirectTo({ url: '/pages/favorite/index' });
    }
  }
});