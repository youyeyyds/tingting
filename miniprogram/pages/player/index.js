// player/index.js
const app = getApp();

Page({
  data: {
    showAnimation: 'slide-up',
    courseCover: '',
    courseTitle: '',
    courseAuthor: '',
    chapterCount: 0,
    currentChapter: {},
    currentIndex: 0,
    chapters: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    currentTimeText: '0:00',
    remainingTimeText: '-0:00',
    showTotalTime: false, // 显示总时长还是剩余时长
    playbackRate: 2,
    playMode: 'sequence', // sequence, loop, single
    sortOrder: 'asc',
    isFavorite: false,
    speedIndicatorPos: 50 // 倍速指示器位置百分比
  },

  bgAudioManager: null,

  onLoad() {
    this.bgAudioManager = app.bgAudioManager;
    this.setupAudioEvents();

    // 从全局获取播放数据
    const { playingCourse, playingChapter, playingIndex, playlistChaptersData, playlistSortOrder, playMode } = app.globalData;

    this.setData({
      courseCover: playingCourse?.cover || '',
      courseTitle: playingCourse?.title || '',
      courseAuthor: playingCourse?.author || '',
      chapterCount: playingCourse?.chapterCount || playlistChaptersData?.length || 0,
      currentChapter: playingChapter || {},
      currentIndex: playingIndex || 0,
      chapters: playlistChaptersData || [],
      sortOrder: playlistSortOrder || 'asc',
      playMode: playMode || 'sequence',
      isPlaying: !this.bgAudioManager.paused,
      currentTime: this.bgAudioManager.currentTime || 0,
      duration: this.bgAudioManager.duration || 0,
      playbackRate: this.bgAudioManager.playbackRate || 2
    });

    this.updateProgress();
    this.updateSpeedIndicator();
    this.checkFavoriteStatus();
  },

  onUnload() {
    // 页面卸载时移除事件监听
    this.bgAudioManager.offTimeUpdate(this.onTimeUpdate);
    this.bgAudioManager.offPlay(this.onPlay);
    this.bgAudioManager.offPause(this.onPause);
    this.bgAudioManager.offEnded(this.onEnded);
  },

  setupAudioEvents() {
    this.bgAudioManager.onTimeUpdate(() => this.onTimeUpdate());
    this.bgAudioManager.onPlay(() => this.onPlay());
    this.bgAudioManager.onPause(() => this.onPause());
    this.bgAudioManager.onEnded(() => this.onEnded());
  },

  onTimeUpdate() {
    const currentTime = this.bgAudioManager.currentTime;
    const duration = this.bgAudioManager.duration;
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    this.setData({
      currentTime,
      progressPercent
    });

    this.updateProgress();
  },

  onPlay() {
    this.setData({ isPlaying: true });
  },

  onPause() {
    this.setData({ isPlaying: false });
  },

  onEnded() {
    // 自动播放下一首
    this.playNext();
  },

  updateProgress() {
    const { currentTime, duration, showTotalTime } = this.data;
    this.setData({
      currentTimeText: this.formatTime(currentTime),
      remainingTimeText: showTotalTime ? this.formatTime(duration) : '-' + this.formatTime(duration - currentTime)
    });
  },

  formatTime(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  updateSpeedIndicator() {
    const { playbackRate } = this.data;
    // 速度范围 1-3，映射到 0-100%
    const speeds = [1, 1.5, 2, 2.5, 3];
    const index = speeds.indexOf(playbackRate);
    const pos = index >= 0 ? (index / (speeds.length - 1)) * 100 : 50;
    this.setData({ speedIndicatorPos: pos });
  },

  checkFavoriteStatus() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId || !app.globalData.userId) return;

    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'checkFavorite',
        chapterId: chapterId,
        userId: app.globalData.userId
      }
    }).then(res => {
      if (res.result.success) {
        this.setData({ isFavorite: res.result.data.isFavorite });
      }
    }).catch(err => console.error('检查收藏状态失败:', err));
  },

  // 收起页面
  handleClose() {
    this.setData({ showAnimation: 'slide-down' });
    setTimeout(() => {
      wx.navigateBack();
    }, 300);
  },

  // 切换时间显示
  toggleTimeDisplay() {
    this.setData({ showTotalTime: !this.data.showTotalTime });
    this.updateProgress();
  },

  // 进度条拖动
  onSliderChanging(e) {
    const value = e.detail.value;
    const duration = this.bgAudioManager.duration;
    const currentTime = (value / 100) * duration;
    this.setData({
      currentTime,
      progressPercent: value
    });
    this.updateProgress();
  },

  // 进度条变化完成
  onSliderChange(e) {
    const value = e.detail.value;
    const duration = this.bgAudioManager.duration;
    const currentTime = (value / 100) * duration;
    this.bgAudioManager.seek(currentTime);
    this.setData({
      currentTime,
      progressPercent: value
    });
    this.updateProgress();
  },

  // 播放/暂停
  togglePlayPause() {
    if (this.bgAudioManager.paused) {
      this.bgAudioManager.play();
    } else {
      this.bgAudioManager.pause();
    }
  },

  // 快退15秒
  rewind15() {
    const currentTime = this.bgAudioManager.currentTime;
    const newTime = Math.max(0, currentTime - 15);
    this.bgAudioManager.seek(newTime);
  },

  // 快进30秒
  forward30() {
    const currentTime = this.bgAudioManager.currentTime;
    const duration = this.bgAudioManager.duration;
    const newTime = Math.min(duration, currentTime + 30);
    this.bgAudioManager.seek(newTime);
  },

  // 上一条
  playPrev() {
    const { currentIndex, chapters, playMode } = this.data;
    let newIndex;

    if (playMode === 'single') {
      // 单曲循环，重新播放当前
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }

    if (currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (playMode === 'loop') {
      newIndex = chapters.length - 1;
    } else {
      wx.showToast({ title: '已经是第一条', icon: 'none' });
      return;
    }

    this.playChapter(newIndex);
  },

  // 下一条
  playNext() {
    const { currentIndex, chapters, playMode } = this.data;
    let newIndex;

    if (playMode === 'single') {
      // 单曲循环，重新播放当前
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }

    if (currentIndex < chapters.length - 1) {
      newIndex = currentIndex + 1;
    } else if (playMode === 'loop') {
      newIndex = 0;
    } else {
      // 顺序播放结束，停止
      this.bgAudioManager.stop();
      this.setData({ isPlaying: false });
      return;
    }

    this.playChapter(newIndex);
  },

  // 播放指定章节
  playChapter(index) {
    const { chapters } = this.data;
    if (index < 0 || index >= chapters.length) return;

    const chapter = chapters[index];
    if (!chapter.audioUrl) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
      return;
    }

    // 保存当前进度
    this.saveProgress();

    // 播放新章节
    this.bgAudioManager.title = chapter.title;
    this.bgAudioManager.src = chapter.audioUrl;
    this.bgAudioManager.coverUrl = this.data.courseCover;
    this.bgAudioManager.episode = `${chapter.seq || index + 1}/${chapters.length}`;

    this.setData({
      currentChapter: chapter,
      currentIndex: index
    });

    // 更新全局
    app.globalData.playingChapter = chapter;
    app.globalData.playingIndex = index;

    // 检查收藏状态
    this.checkFavoriteStatus();
  },

  // 保存播放进度
  saveProgress() {
    const chapterId = this.data.currentChapter._id;
    const currentTime = this.bgAudioManager.currentTime;
    const duration = this.bgAudioManager.duration;

    if (!chapterId || !currentTime) return;

    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'updateChapterProgress',
        chapterId: chapterId,
        courseId: this.data.currentChapter.course,
        lastPlayTime: currentTime,
        finished: currentTime >= duration - 10,
        userId: app.globalData.userId
      }
    }).catch(err => console.error('保存进度失败:', err));
  },

  // 切换播放模式
  togglePlayMode() {
    const modes = ['sequence', 'loop', 'single'];
    const currentIdx = modes.indexOf(this.data.playMode);
    const nextIdx = (currentIdx + 1) % modes.length;
    const newMode = modes[nextIdx];

    this.setData({ playMode: newMode });
    app.globalData.playMode = newMode;

    wx.showToast({
      title: newMode === 'sequence' ? '顺序播放' : newMode === 'loop' ? '列表循环' : '单曲循环',
      icon: 'none'
    });
  },

  // 显示播放列表
  showPlaylist() {
    wx.showToast({ title: '播放列表功能开发中', icon: 'none' });
  },

  // 切换排序
  toggleSort() {
    const newOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc';
    const newChapters = [...this.data.chapters].reverse();

    this.setData({
      sortOrder: newOrder,
      chapters: newChapters,
      currentIndex: newChapters.length - 1 - this.data.currentIndex
    });

    app.globalData.playlistSortOrder = newOrder;
    app.globalData.playlistChaptersData = newChapters;
  },

  // 切换收藏
  toggleFavorite() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId) return;

    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'toggleFavorite',
        chapterId: chapterId,
        userId: app.globalData.userId
      }
    }).then(res => {
      if (res.result.success) {
        this.setData({ isFavorite: res.result.data.isFavorite });
        wx.showToast({
          title: res.result.data.isFavorite ? '已收藏' : '已取消收藏',
          icon: 'success'
        });
      }
    }).catch(err => {
      console.error('切换收藏失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 设置倍速
  setSpeed(e) {
    const rate = e.currentTarget.dataset.rate;
    this.bgAudioManager.playbackRate = rate;
    this.setData({ playbackRate: rate });
    this.updateSpeedIndicator();
  }
});