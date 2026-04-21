// login/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    contentInnerHeight: 0, // content-inner 高度（填满剩余空间）
    phone: '',
    password: '',
    loading: false,
    headlines: [],
    refresherTriggered: false,
    copyrightText: '',
    icpNumber: '',
    loadTime: 0, // 横幅时间戳（封面只在首页刷新才更新）
    bannerSpeed: 5000 // 轮播速度
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    // 计算导航栏高度（与首页一致）
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    const headerHeight = windowInfo.statusBarHeight + navBarHeight;
    // content-inner 高度 = 屏幕高度 - header - banner(280rpx转px)
    const rpxToPx = windowInfo.windowWidth / 750;
    const bannerHeightPx = 280 * rpxToPx;
    const contentInnerHeight = windowInfo.windowHeight - headerHeight - bannerHeightPx;
    // 使用全局时间戳和数据缓存，保持图片稳定
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    const loadTime = app.globalData.bannerLoadTime;
    // 检查是否有缓存的横幅数据
    const cachedHeadlines = app.globalData.loginHeadlines || [];
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight,
      contentInnerHeight: contentInnerHeight,
      loadTime: loadTime,
      headlines: cachedHeadlines
    });
    // 只在首次加载（无缓存）时获取数据
    if (cachedHeadlines.length === 0) {
      this.loadHeadlines();
      this.loadCopyright();
    }
  },

  handleBack() {
    wx.navigateBack();
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
    Promise.all([
      this.loadHeadlinesAsync(),
      this.loadCopyrightAsync()
    ]).then(() => {
      this.setData({ refresherTriggered: false });
    });
  },

  loadHeadlinesAsync() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'login' }
    })
    .then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.fixImageUrl(h.image, 'banner')
        }));
        // 缓存到全局变量
        app.globalData.loginHeadlines = headlines;
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  loadCopyrightAsync() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCopyright' }
    })
    .then(res => {
      if (res.result.success && res.result.data) {
        this.setData({
          copyrightText: res.result.data.copyrightText || '',
          icpNumber: res.result.data.icpNumber || ''
        });
      }
    })
    .catch(err => console.error('获取版权信息失败', err));
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

  loadHeadlines() {
    this.loadHeadlinesAsync();
  },

  loadCopyright() {
    this.loadCopyrightAsync();
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async handleLogin() {
    if (this.data.loading) return;

    const { phone, password } = this.data;

    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'userFunctions',
        data: {
          type: 'login',
          phone: phone,
          password: password
        }
      });

      if (res.result.success) {
        const user = res.result.data;

        // 保存用户信息到全局
        app.globalData.isLoggedIn = true;
        app.globalData.userInfo = user;
        app.globalData.userId = user.userId;

        // 保存到本地存储
        wx.setStorageSync('userId', user.userId);
        wx.setStorageSync('userInfo', JSON.stringify(user));

        // 保持登录中状态，直接跳转到个人页面
        wx.redirectTo({ url: '/pages/mine/index' });
        return; // 成功时不执行 finally 中的 loading: false
      } else {
        // 统一提示：手机号或密码错误
        wx.showToast({ title: '手机号或密码错误', icon: 'none' });
      }
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '手机号或密码错误', icon: 'none' });
    }

    // 只有失败时才恢复按钮状态
    this.setData({ loading: false });
  }
});