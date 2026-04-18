// login/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: -1,
    phone: '',
    password: '',
    loading: false
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight
    });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  handleBack() {
    wx.navigateBack({ delta: 1 });
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

        wx.showToast({ title: '登录成功', icon: 'success' });

        // 跳转到我的页面
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/mine/index' });
        }, 500);
      } else {
        wx.showToast({ title: res.result.error || '登录失败', icon: 'none' });
      }
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    wx.redirectTo({ url: `/pages/${['index', 'favorite', 'mine'][index]}/index` });
  }
});