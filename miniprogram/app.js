// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "cloud1-2g5y53suf638dfb9",
        traceUser: true
      });
    }

    // 初始化背景音频管理器
    this.bgAudioManager = wx.getBackgroundAudioManager();
    this.miniPlayerCallbacks = [];
    this.setupAudioEvents();

    // 尝试恢复登录状态
    this.restoreLoginState();
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    userId: null,
    playingCourse: null,
    playingChapter: null,
    playingIndex: 0,
    miniPlayerActive: false,
    miniPlayerIndexFadedIn: false,
    playMode: 'sequence', // 'sequence' | 'loop' | 'single'
    playlistChaptersData: [], // 完整的播放列表数据
    playlistSortOrder: 'asc' // 'asc' | 'desc'
  },

  restoreLoginState() {
    const userId = wx.getStorageSync('userId');
    const userInfoStr = wx.getStorageSync('userInfo');
    if (userId && userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        this.globalData.isLoggedIn = true;
        this.globalData.userId = userId;
        this.globalData.userInfo = userInfo;
      } catch (e) {
        console.error('恢复登录状态失败:', e);
      }
    }
  },

  // 设置背景音频事件
  setupAudioEvents() {
    const bgAudio = this.bgAudioManager;

    bgAudio.onCanplay(() => {
      bgAudio.playbackRate = 2;
      const duration = bgAudio.duration;
      if (duration && duration > 0) {
        this.notifyCallbacks('onCanplay', {
          duration: duration
        });
      }
    });

    bgAudio.onPlay(() => {
      this.notifyCallbacks('onPlay', {});
    });

    bgAudio.onPause(() => {
      this.notifyCallbacks('onPause', {});
    });

    bgAudio.onTimeUpdate(() => {
      const currentTime = bgAudio.currentTime;
      const duration = bgAudio.duration;
      const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
      this.notifyCallbacks('onTimeUpdate', {
        currentTime: currentTime,
        progressPercent: percent
      });
    });

    bgAudio.onEnded(() => {
      this.notifyCallbacks('onEnded', {});
    });

    bgAudio.onError((err) => {
      console.error('播放错误:', err);
      this.notifyCallbacks('onError', {});
    });

    bgAudio.onStop(() => {
      this.notifyCallbacks('onStop', {});
    });
  },

  // 通知所有 mini-player 回调
  notifyCallbacks(event, data) {
    this.miniPlayerCallbacks.forEach(cb => {
      if (cb[event]) cb[event](data);
    });
  },

  // 注册 mini-player 回调
  registerMiniPlayer(callback) {
    this.miniPlayerCallbacks.push(callback);
  },

  // 移除 mini-player 回调
  unregisterMiniPlayer(callback) {
    const index = this.miniPlayerCallbacks.indexOf(callback);
    if (index > -1) this.miniPlayerCallbacks.splice(index, 1);
  }
});