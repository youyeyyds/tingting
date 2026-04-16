// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "cloud1-2g5y53suf638dfb9",
        traceUser: true,
      });
    }
  },
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    currentPagePath: '',
    tabBarHeight: 0,
    playingCourse: null,
    playingChapter: null,
    playingIndex: 0
  }
});