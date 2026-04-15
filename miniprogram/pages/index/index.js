// index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    isLoggedIn: false,
    courses: [],
    loading: true,
    activeTab: 0
  },

  onLoad() {
    // 获取系统状态栏高度和胶囊按钮信息
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();

    // 胶囊按钮高度 + 上下间距
    const navBarHeight = (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height;

    // 顶部总高度：状态栏 + 标题栏
    const headerHeight = systemInfo.statusBarHeight + navBarHeight;

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight
    });
    this.checkLoginStatus();
    this.loadCourses();
  },

  onShow() {
    this.checkLoginStatus();
    this.loadCourses();
  },

  // 从云函数获取课程列表（绕过数据库权限）
  loadCourses() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'getCourses',
        limit: 20,
        filterDraft: true  // 过滤草稿状态课程
      }
    })
    .then(res => {
      console.log('云函数返回', res);
      if (res.result.success) {
        console.log('获取课程列表成功', res.result.data);
        console.log('数据条数', res.result.data.length);
        this.setData({
          courses: res.result.data,
          loading: false
        });
      } else {
        console.error('云函数执行失败', res.result.errMsg);
        this.setData({
          loading: false
        });
      }
    })
    .catch(err => {
      console.error('调用云函数失败', err);
      this.setData({
        loading: false
      });
    });
  },

  checkLoginStatus() {
    const isLoggedIn = app.globalData.isLoggedIn || false;
    this.setData({ isLoggedIn });
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 退出登录
      app.globalData.isLoggedIn = false;
      app.globalData.userInfo = null;
      this.setData({ isLoggedIn: false });
      wx.showToast({
        title: '已退出',
        icon: 'success'
      });
    } else {
      // 登录
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          app.globalData.isLoggedIn = true;
          app.globalData.userInfo = res.userInfo;
          this.setData({ isLoggedIn: true });
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
        },
        fail: () => {
          wx.showToast({
            title: '登录取消',
            icon: 'none'
          });
        }
      });
    }
  },

  onSearch() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    });
  },

  onCourseTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.showToast({
      title: '课程详情开发中',
      icon: 'none'
    });
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index === 0) return;
    const pages = ['', 'favorite', 'mine'];
    wx.redirectTo({
      url: `/pages/${pages[index]}/index`
    });
  }
});