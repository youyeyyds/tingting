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
    loadTime: '', // 加载时间戳，用于图片URL
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
    // 使用全局 loadTime，保持图片稳定，只在首次或下拉刷新时更新
    if (!app.globalData.loginPageLoadTime) {
      app.globalData.loginPageLoadTime = Date.now();
    }
    const loadTime = app.globalData.loginPageLoadTime;
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight,
      contentInnerHeight: contentInnerHeight,
      loadTime: loadTime
    });
    this.loadHeadlines();
    this.loadCopyright();
  },

  handleBack() {
    wx.navigateBack();
  },

  onRefresh() {
    const newLoadTime = Date.now();
    app.globalData.loginPageLoadTime = newLoadTime; // 更新全局时间戳
    this.setData({ refresherTriggered: true, loadTime: newLoadTime });
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