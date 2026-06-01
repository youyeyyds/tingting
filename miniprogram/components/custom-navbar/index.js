// custom-navbar/index.js
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
      try {
        const systemInfo = wx.getWindowInfo();
        const statusBarHeight = systemInfo.statusBarHeight || 20;

        // 获取右上角胶囊按钮位置信息
        const menuButton = wx.getMenuButtonBoundingClientRect();

        // 胶囊位置信息
        const menuButtonTop = menuButton.top;
        const menuButtonHeight = menuButton.height;
        const menuButtonWidth = menuButton.width;
        const menuButtonRight = menuButton.right;

        // 导航栏内容高度 = 胶囊高度 + 上下边距
        // 上边距 = 胶囊top - 状态栏高度
        const menuButtonMarginTop = menuButtonTop - statusBarHeight;
        const navContentHeight = menuButtonHeight + menuButtonMarginTop * 2;

        // 计算左侧按钮距离屏幕左边的距离
        // 右侧胶囊距离屏幕右边的距离 = 屏幕宽度 - 胶囊右边位置
        // 左侧按钮距离屏幕左边的距离 = 右侧胶囊距离屏幕右边的距离（保持对称）
        const windowWidth = systemInfo.windowWidth || systemInfo.screenWidth;
        const menuButtonLeftGap = windowWidth - menuButtonRight;

        this.setData({
          statusBarHeight,
          navContentHeight,
          menuButtonHeight,
          menuButtonWidth,
          menuButtonLeftGap
        });
      } catch (e) {
        console.error('初始化导航栏失败:', e);
        // 使用默认值
        this.setData({
          statusBarHeight: 20,
          navContentHeight: 44,
          menuButtonHeight: 32,
          menuButtonWidth: 87,
          menuButtonLeftGap: 10
        });
      }
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