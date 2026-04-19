// mine/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: 2,
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
    loadTime: '',
    canGoBack: true, // 是否可以返回上一页
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
    const t = Date.now();
    return avatar.includes('?') ? `${avatar}&t=${t}` : `${avatar}?t=${t}`;
  },

  // 计算隐藏手机号中间5位
  maskPhone(phone) {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d{5}(\d{3})/, '$1*****$2');
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    const loadTime = Date.now();
    // 检查是否有上一页可以返回
    const pages = getCurrentPages();
    const canGoBack = pages.length > 1;
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      loadTime: loadTime,
      canGoBack: canGoBack
    });
    this.checkLoginStatus();
    this.loadHeadlines();
  },

  onShow() {
    this.checkLoginStatus();
    // 未登录时跳转到登录页
    if (!this.data.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/index' });
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
    const newLoadTime = Date.now();
    this.setData({ refresherTriggered: true, loadTime: newLoadTime });
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

  handleBack() {
    if (this.data.canGoBack) {
      wx.navigateBack();
    } else {
      wx.redirectTo({ url: '/pages/index/index' });
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
          image: this.addTimestamp(h.image)
        }));
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

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

    // 直接跳转到登录页
    wx.redirectTo({ url: '/pages/login/index' });
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
    if (index == 2) return;
    // 未登录时跳转登录页
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.redirectTo({ url: `/pages/${['index', 'favorite', ''][index]}/index` });
  }
});