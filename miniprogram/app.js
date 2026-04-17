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
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    playingCourse: null,
    playingChapter: null,
    playingIndex: 0,
    miniPlayerActive: false,
    miniPlayerIndexFadedIn: false
  },

  // 设置背景音频事件
  setupAudioEvents() {
    const bgAudio = this.bgAudioManager;

    bgAudio.onCanplay(() => {
      bgAudio.playbackRate = 2;
      this.notifyCallbacks('onCanplay', {
        duration: bgAudio.duration
      });
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