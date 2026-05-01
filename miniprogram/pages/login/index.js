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
    loadTime: 0, // 横幅时间戳
    _wasHidden: false // 页面是否曾被隐藏（用于判断是否需要同步）
  },

  onLoad() {
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    const loadTime = app.globalData.bannerLoadTime;
    // 优先使用首页缓存的 headlines（同一云函数返回，数据相同）
    let cachedHeadlines = app.globalData.indexHeadlines || [];
    const cachedCopyright = app.globalData.loginCopyright || {};

    // 如果有缓存，需要用当前时间戳重建 URL
    if (cachedHeadlines.length > 0) {
      cachedHeadlines = cachedHeadlines.map(h => ({
        ...h,
        image: this.processImageUrl(h.image, loadTime)
      }));
    }

    this.setData({
      loadTime,
      headlines: cachedHeadlines,
      copyrightLines: cachedCopyright.copyrightLines || [],
      icpNumber: cachedCopyright.icpNumber || '',
      _prevBannerTime: loadTime, // 记录进入时的banner时间戳
      _loading: false // 标记是否正在加载
    });

    if (cachedHeadlines.length === 0) {
      this.loadHeadlines();
    }
    if (!cachedCopyright.copyrightLines) this.loadCopyright();
  },

  onShow() {
    // 已登录则跳转到首页
    if (app.globalData.isLoggedIn) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    // 只有banner时间戳变化了才同步（其他页面刷新了）
    const currentBannerTime = app.globalData.bannerLoadTime;
    if (currentBannerTime !== this.data._prevBannerTime && !this.data._loading) {
      this.syncImageTimes();
    }
  },

  // 同步图片时间戳（其他页面刷新后返回需要更新图片）
  syncImageTimes() {
    const bt = app.globalData.bannerLoadTime;
    const headlines = this.data.headlines.map(h => ({
      ...h,
      image: this.processImageUrl(h.image, bt)
    }));
    this.setData({ loadTime: bt, headlines });
    app.globalData.indexHeadlines = headlines; // 同步回首页缓存
  },

  loadHeadlines() {
    this.setData({ _loading: true });
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'login' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.processImageUrl(h.image, this.data.loadTime)
        }));
        app.globalData.indexHeadlines = headlines; // 同步到首页缓存
        this.setData({
          headlines,
          bannerSpeed: (res.result.speed || 5) * 1000,
          _loading: false
        });
      }
    }).catch(err => {
      console.error('获取头条失败', err);
      this.setData({ _loading: false });
    });
  },

  loadCopyright() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCopyright' }
    }).then(res => {
      if (res.result.success) {
        const data = res.result.data || {};
        const copyrightText = data.copyrightText || 'youyeyyds\nPowered by Claude Code\n版本号：v0.1.0';
        const icpNumber = data.icpNumber || '粤ICP备2026041617号-1X';
        const copyrightLines = copyrightText.split('\n').filter(line => line.trim());

        app.globalData.loginCopyright = { copyrightLines, icpNumber };
        this.setData({ copyrightLines, icpNumber });
      }
    }).catch(err => console.error('获取版权信息失败', err));
  },

  processImageUrl(url, loadTime) {
    if (!url) return url;
    // 如果没有传入 loadTime，则从全局获取
    if (loadTime === undefined) {
      loadTime = app.globalData.bannerLoadTime;
    }

    // 固定图片不处理
    if (url.includes('seed/fixed_')) return url;

    // 已处理的时间戳格式，更新时间戳
    const timeMatch = url.match(/seed\/(\d+)_banner_(.+\/\d+\/\d+)$/);
    if (timeMatch && timeMatch[1] != loadTime) {
      return url.replace(/seed\/\d+_banner_/, `seed/${loadTime}_banner_`);
    }
    if (timeMatch && timeMatch[1] == loadTime) {
      return url;
    }

    // seed 格式（非时间戳），添加时间戳
    const seedMatch = url.match(/seed\/([^\/]+)\/(\d+\/\d+)$/);
    if (seedMatch) {
      return `https://picsum.photos/seed/${loadTime}_banner_${seedMatch[1]}/${seedMatch[2]}`;
    }

    // 无 seed 格式，转换为 seed
    const sizeMatch = url.match(/picsum\.photos\/(\d+\/\d+)/);
    if (sizeMatch) {
      const random = url.match(/random=(\d+)/)?.[1] || '0';
      return `https://picsum.photos/seed/${loadTime}_banner_${random}/${sizeMatch[1]}`;
    }

    // 其他 URL 添加时间戳
    return url.includes('?') ? `${url}&t=${loadTime}` : `${url}?t=${loadTime}`;
  },

  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onPasswordInput(e) { this.setData({ password: e.detail.value }); },

  // 缓存头像临时URL（登录时调用一次，之后mine页直接用缓存）
  async cacheAvatarTempUrl(user) {
    if (user.avatarFileID && user.avatarFileID.startsWith('cloud://')) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: [user.avatarFileID] });
        if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
          app.globalData.cachedAvatarFileID = user.avatarFileID;
          app.globalData.cachedAvatarTempUrl = res.fileList[0].tempFileURL;
        }
      } catch (e) {
        console.error('缓存头像临时URL失败:', e);
      }
    } else {
      // 非云文件ID，直接用avatarUrl
      app.globalData.cachedAvatarFileID = null;
      app.globalData.cachedAvatarTempUrl = user.avatarUrl || '';
    }
  },

  onKeyboardHeightChange(e) {
    const { height } = e.detail;
    if (height > 0) {
      if (this.data.headlines.length > 0 && !this.data.bannerHidden) {
        this.setData({ bannerHidden: true });
      }
      if (this._bannerTimer) {
        clearTimeout(this._bannerTimer);
        this._bannerTimer = null;
      }
    } else if (this.data.bannerHidden && !this._bannerTimer) {
      this._bannerTimer = setTimeout(() => {
        this.setData({ bannerHidden: false });
        this._bannerTimer = null;
      }, 100);
    }
  },

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
        // 缓存头像临时URL
        this.cacheAvatarTempUrl(user);
        wx.navigateBack({ delta: 1 });
        return;
      }
      wx.showToast({ title: '手机号或密码错误', icon: 'none' });
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '手机号或密码错误', icon: 'none' });
    }
    this.setData({ loading: false });
  }
});