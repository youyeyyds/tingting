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
      favoriteCount: 0,
      totalPlayCount: 0,
      totalStudyMinutes: 0,
      joinedMinutes: 0
    },
    studyTime: { days: 0, hours: 0, mins: 0 }, // 学习时长拆分
    joinedTime: { days: 0, hours: 0, mins: 0 }, // 加入听听拆分
    loading: false,
    loadTime: 0, // 横幅时间戳
    bannerSpeed: 5000, // 轮播速度
    activeTab: 2, // 我的页为 tab 2
    refreshConfirmVisible: false, // 刷新图片确认弹窗
    logoutConfirmVisible: false // 退出登录确认弹窗
  },

  // 格式化分钟数，返回拆分后的对象
  formatMinutesToObj(minutes) {
    if (!minutes || minutes <= 0) return { days: 0, hours: 0, mins: 0 };
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    return { days, hours, mins };
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
    let cachedHeadlines = app.globalData.mineHeadlines || [];

    // 如果有缓存，需要用当前时间戳重建 URL
    if (cachedHeadlines.length > 0) {
      cachedHeadlines = cachedHeadlines.map(h => ({
        ...h,
        image: this.fixImageUrl(h.image, 'banner', loadTime)
      }));
    }

    this.setData({
      loadTime: loadTime,
      headlines: cachedHeadlines
    });
    this.checkLoginStatus();
    // 刷新头像 temp URL（只在 avatarFileID 变化时才更新，避免切换页面时闪烁）
    this.refreshAvatarTempUrl();
    // 只在首次加载（无缓存）时获取横幅数据
    if (cachedHeadlines.length === 0) {
      this.loadHeadlines();
    }
  },

  onShow() {
    // 同步全局登录状态，避免 navigateBack 回来时 local state 仍是旧值
    this.checkLoginStatus();
    // 未登录时跳转到首页
    if (!this.data.isLoggedIn) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    // 切换页面时不重新加载，保持原有数据
    if (app.globalData.userId) {
      this.loadUserStats();
    }
    // 同步图片时间戳变化
    this.syncImageTimes();
  },

  // 同步图片时间戳（其他页面刷新后返回需要更新图片）
  syncImageTimes() {
    const bt = app.globalData.bannerLoadTime;

    // 同步横幅时间戳
    if (bt !== this.data.loadTime) {
      const headlines = this.data.headlines.map(h => ({
        ...h,
        image: this.fixImageUrl(h.image, 'banner', bt)
      }));
      this.setData({ loadTime: bt, headlines });
      app.globalData.mineHeadlines = headlines;
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
        // 更新 userInfo 和 maskedPhone（头像由 refreshAvatarTempUrl 单独处理）
        const newAvatarUrl = user.avatarFileID && user.avatarFileID.startsWith('cloud://')
          ? (app.globalData.cachedAvatarTempUrl || user.avatarUrl)
          : (user.avatarUrl || '/icons/svg/avatar.svg');
        this.setData({
          userInfo: user,
          avatarUrl: newAvatarUrl,
          maskedPhone: this.maskPhone(user.phone)
        });
      }
    } catch (err) {
      console.error('刷新用户信息失败:', err);
    }
  },

  // 刷新头像临时URL（仅在 avatarFileID 变化时更新），在 onLoad 中调用一次
  async refreshAvatarTempUrl() {
    const user = app.globalData.userInfo;
    if (!user) return;
    if (user.avatarFileID && user.avatarFileID.startsWith('cloud://')) {
      const cachedFileID = app.globalData.cachedAvatarFileID;
      const cachedTempUrl = app.globalData.cachedAvatarTempUrl;
      if (cachedFileID === user.avatarFileID && cachedTempUrl) {
        // avatarFileID 没变，用缓存，不触发 setData 避免闪烁
        return;
      }
      // avatarFileID 变了或无缓存，获取新临时URL
      try {
        const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: [user.avatarFileID] });
        if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].tempFileURL) {
          const newTempUrl = tempUrlRes.fileList[0].tempFileURL;
          app.globalData.cachedAvatarFileID = user.avatarFileID;
          app.globalData.cachedAvatarTempUrl = newTempUrl;
          this.setData({ avatarUrl: newTempUrl });
        }
      } catch (e) {
        console.error('获取头像临时URL失败:', e);
      }
    }
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
          image: this.fixImageUrl(h.image, 'banner', this.data.loadTime)
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
  // loadTime 可选，默认从 this.data 获取
  fixImageUrl(url, type = 'banner', loadTime) {
    if (!url) return url;

    // 检查是否为固定图片（seed以fixed_开头），不替换时间戳
    if (url.match(/picsum\.photos\/seed\/fixed_/)) {
      return url; // 固定图片，直接返回
    }

    // 如果没有传入 loadTime，则从 this.data 获取
    if (loadTime === undefined) {
      loadTime = this.data.loadTime;
    }

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
        // 学习时长只算到时
        const totalMins = stats.totalStudyMinutes || 0;
        const studyHours = Math.floor(totalMins / 60);
        const studyMins = totalMins % 60;
        const studyTime = { days: 0, hours: studyHours, mins: studyMins };
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

  handleRefreshImages() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 点击刷新图片，显示确认弹窗
  onRefreshTap() {
    this.setData({ refreshConfirmVisible: true });
  },

  // 取消刷新图片
  onRefreshCancel() {
    this.setData({ refreshConfirmVisible: false });
  },

  // 确认刷新图片（与下拉刷新功能相同）
  onRefreshConfirm() {
    this.setData({ refreshConfirmVisible: false });
    const t = Date.now();
    app.globalData.bannerLoadTime = t;
    app.globalData.coverLoadTime = t;
    wx.setStorageSync('bannerLoadTime', t);
    wx.setStorageSync('coverLoadTime', t);
    this.setData({ loadTime: t });
    // 立即广播事件，确保 index 页面及时响应
    app.notifyCallbacks?.('onCoverRefresh', { coverLoadTime: t });
    // 异步加载数据
    Promise.all([
      this.loadHeadlines(),
      this.refreshUserInfo(),
      this.loadUserStats()
    ]);
  },

  // 点击退出登录，显示确认弹窗
  onLogoutTap() {
    this.setData({ logoutConfirmVisible: true });
  },

  // 取消退出登录
  onLogoutCancel() {
    this.setData({ logoutConfirmVisible: false });
  },

  // 确认退出登录
  onLogoutConfirm() {
    this.setData({ logoutConfirmVisible: false });

    // 退出登录（通用逻辑）
    app.logout();

    // 跳转到首页 tabBar
    const pages = getCurrentPages();
    const indexPage = pages.find(p => p.route === 'pages/index/index');
    if (indexPage) {
      const delta = pages.length - pages.indexOf(indexPage) - 1;
      wx.navigateBack({ delta });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  handleChangeAvatar() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  handleChangeNickname() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  handleChangePassword() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  handleVersionInfo() {
    wx.navigateTo({ url: '/pages/version/index' });
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
    const targetRoute = index == 0 ? 'pages/index/index' : 'pages/favorite/index';
    const pages = getCurrentPages();
    const targetPage = pages.find(p => p.route === targetRoute);
    if (targetPage) {
      const delta = pages.length - pages.indexOf(targetPage) - 1;
      if (delta > 0) {
        wx.navigateBack({ delta });
      } else {
        // 目标页就是当前页，不处理
      }
    } else {
      wx.navigateTo({ url: `/${targetRoute}` });
    }
  }
});