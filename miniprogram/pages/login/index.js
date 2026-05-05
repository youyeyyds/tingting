// login/index.js
const app = getApp();

Page({
  data: {
    phone: '',
    password: '',
    loading: false,
    headlines: [],
    copyrightLines: [],
    icpNumber: '',
    bannerSpeed: 5000,
    bannerHidden: false,
    loadTime: 0
  },

  onLoad() {
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    const loadTime = app.globalData.bannerLoadTime;
    const cachedHeadlines = app.globalData.homePageHeadlines || [];
    const cachedCopyright = app.globalData.loginCopyright || {};

    // 有缓存则用当前时间戳重建 URL
    const headlines = cachedHeadlines.length > 0
      ? cachedHeadlines.map(h => ({ ...h, image: this.processImageUrl(h.image, loadTime) }))
      : [];

    this.setData({
      loadTime,
      headlines,
      copyrightLines: cachedCopyright.copyrightLines || [],
      icpNumber: cachedCopyright.icpNumber || '',
      _prevBannerTime: loadTime
    });

    if (!headlines.length) this.loadHeadlines();
    if (!cachedCopyright.copyrightLines) this.loadCopyright();
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    // banner时间戳变化则同步
    const bt = app.globalData.bannerLoadTime;
    if (bt !== this.data._prevBannerTime) {
      this.syncImageTimes();
    }
  },

  // 同步图片时间戳
  syncImageTimes() {
    const bt = app.globalData.bannerLoadTime;
    const headlines = this.data.headlines.map(h => ({
      ...h,
      image: this.processImageUrl(h.image, bt)
    }));
    this.setData({ loadTime: bt, headlines });
    app.globalData.homePageHeadlines = headlines;
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'login' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.processImageUrl(h.image, this.data.loadTime)
        }));
        app.globalData.homePageHeadlines = headlines;
        this.setData({ headlines, bannerSpeed: (res.result.speed || 5) * 1000 });
      }
    }).catch(err => console.error('获取头条失败', err));
  },

  loadCopyright() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCopyright' }
    }).then(res => {
      if (res.result.success) {
        const data = res.result.data || {};
        const text = data.copyrightText || 'youyeyyds\nPowered by Claude Code\n版本号：v0.1.0';
        const copyrightLines = text.split('\n').filter(l => l.trim());
        app.globalData.loginCopyright = { copyrightLines, icpNumber: data.icpNumber || '' };
        this.setData({ copyrightLines, icpNumber: data.icpNumber || '' });
      }
    }).catch(err => console.error('获取版权信息失败', err));
  },

  processImageUrl(url, loadTime) {
    if (!url) return url;
    if (url.includes('seed/fixed_')) return url;

    const timeMatch = url.match(/seed\/(\d+)_banner_(.+\/\d+\/\d+)$/);
    if (timeMatch) {
      return timeMatch[1] != loadTime
        ? url.replace(/seed\/\d+_banner_/, `seed/${loadTime}_banner_`)
        : url;
    }

    const seedMatch = url.match(/seed\/([^\/]+)\/(\d+\/\d+)$/);
    if (seedMatch) {
      return `https://picsum.photos/seed/${loadTime}_banner_${seedMatch[1]}/${seedMatch[2]}`;
    }

    const sizeMatch = url.match(/picsum\.photos\/(\d+\/\d+)/);
    if (sizeMatch) {
      const r = url.match(/random=(\d+)/)?.[1] || '0';
      return `https://picsum.photos/seed/${loadTime}_banner_${r}/${sizeMatch[1]}`;
    }

    return url.includes('?') ? `${url}&t=${loadTime}` : `${url}?t=${loadTime}`;
  },

  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onPasswordInput(e) { this.setData({ password: e.detail.value }); },

  async handleLogin() {
    if (this.data.loading) return;
    const { phone, password } = this.data;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: !phone ? '请输入手机号' : '请输入正确的手机号', icon: 'none' });
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
        data: { type: 'login', phone, password }
      });

      if (res.result.success) {
        const user = res.result.data;
        app.globalData.isLoggedIn = true;
        app.globalData.userInfo = user;
        app.globalData.userId = user.userId;
        app.globalData.loginFlag = true;
        app.globalData.logoutFlag = false;
        app.globalData.needRestoreMaskedData = false;
        wx.setStorageSync('userId', user.userId);
        wx.setStorageSync('userInfo', JSON.stringify(user));
        // 缓存头像
        if (user.avatarFileID?.startsWith('cloud://')) {
          try {
            const temp = await wx.cloud.getTempFileURL({ fileList: [user.avatarFileID] });
            if (temp.fileList?.[0]?.tempFileURL) {
              app.globalData.cachedAvatarFileID = user.avatarFileID;
              app.globalData.cachedAvatarTempUrl = temp.fileList[0].tempFileURL;
            }
          } catch (e) { console.error('缓存头像失败', e); }
        }
        // 缓存用户统计
        try {
          const stats = await wx.cloud.callFunction({
            name: 'userFunctions',
            data: { type: 'getUserStats', userId: user.userId }
          });
          if (stats.result?.success) {
            app.globalData.cachedUserStats = stats.result.data;
          }
        } catch (e) { console.error('缓存用户统计失败', e); }

        wx.navigateBack({ delta: 1 });
        return;
      }
      wx.showToast({ title: '手机号或密码错误', icon: 'none' });
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '手机号或密码错误', icon: 'none' });
    }
    this.setData({ loading: false });
  },

  onKeyboardHeightChange(e) {
    const { height } = e.detail;
    if (height > 0) {
      if (this.data.headlines.length > 0 && !this.data.bannerHidden) {
        this.setData({ bannerHidden: true });
      }
    } else if (this.data.bannerHidden) {
      setTimeout(() => this.setData({ bannerHidden: false }), 100);
    }
  }
});