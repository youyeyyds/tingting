// custom-navbar/index.js
const app = getApp();

Component({
  properties: {
    showHome: {
      type: Boolean,
      value: true
    },
    showBack: {
      type: Boolean,
      value: true
    },
    showLoginBtn: {
      type: Boolean,
      value: false
    },
    loginText: {
      type: String,
      value: 'Log in'
    },
    title: {
      type: String,
      value: ''
    },
    showOverlayBtns: {
      type: Boolean,
      value: false
    },
    overlayCloseIcon: {
      type: String,
      value: '/icons/svg/arrow-left.svg'
    },
    overlayHomeIcon: {
      type: String,
      value: '/icons/svg/home-white.svg'
    },
    iconColor: {
      type: String,
      value: 'black'
    },
    titleColor: {
      type: String,
      value: 'black'
    },
    transparent: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 0,
    navContentHeight: 0,
    menuButtonHeight: 0,
    menuButtonWidth: 0,
    menuButtonLeftGap: 0
  },

  lifetimes: {
    attached() {
      this.initNavBar();
    }
  },

  methods: {
    initNavBar() {
      const g = app.globalData;
      this.setData({
        statusBarHeight: g.statusBarHeight,
        navContentHeight: g.navBarHeight,
        menuButtonHeight: g.menuButtonHeight,
        menuButtonWidth: g.menuButtonWidth,
        menuButtonLeftGap: g.menuButtonLeftGap
      });
    },

    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({ fail: () => {
          wx.reLaunch({ url: '/pages/index/index' });
        }});
      } else {
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }
      this.triggerEvent('back');
    },

    onHome() {
      wx.reLaunch({
        url: '/pages/index/index'
      });
      this.triggerEvent('home');
    },

    onLogin() {
      this.triggerEvent('login');
    },

    onOverlayClose() {
      this.triggerEvent('overlayclose');
    },

    onOverlayHome() {
      this.triggerEvent('overlayhome');
    }
  }
});