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
    showTotalTime: false,
    playbackRate: 2,
    playMode: 'sequence',
    sortOrder: 'asc',
    isFavorite: false,
    speedIndicatorPos: 50,
    coverLoadTime: 0,
    startY: 0,
    translateY: 0
  },

  bgAudioManager: null,

  onLoad() {
    this.bgAudioManager = app.bgAudioManager;
    this.setupAudioEvents();

    const coverLoadTime = app.globalData.coverLoadTime || Date.now();
    const { playingCourse, playingChapter, playingIndex, playlistChaptersData, playlistSortOrder, playMode } = app.globalData;
    const courseCover = this.processImageUrl(playingCourse?.cover || '', coverLoadTime);

    this.setData({
      courseCover,
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
      playbackRate: this.bgAudioManager.playbackRate || 2,
      coverLoadTime
    });

    this.updateProgress();
    this.updateSpeedIndicator();
    this.checkFavoriteStatus();
  },

  // 下滑关闭相关
  onTouchStart(e) {
    this.setData({ startY: e.touches[0].clientY, translateY: 0 });
  },

  onTouchMove(e) {
    const deltaY = e.touches[0].clientY - this.data.startY;
    if (deltaY > 0) {
      this.setData({ translateY: deltaY });
    }
  },

  onTouchEnd() {
    const { translateY } = this.data;
    if (translateY > 100) {
      this.closePage();
    } else {
      this.setData({ translateY: 0 });
    }
  },

  closePage() {
    this.setData({ showAnimation: 'slide-down' });
    setTimeout(() => wx.navigateBack(), 300);
  },

  processImageUrl(url, coverLoadTime) {
    if (!url || url.includes('seed/fixed_')) return url;
    const t = coverLoadTime || app.globalData.coverLoadTime || Date.now();

    const m1 = url.match(/seed\/(\d+)_cover_/);
    if (m1 && m1[1] != t) return url.replace(/seed\/\d+_cover_/, `seed/${t}_cover_`);
    if (m1) return url;

    const m2 = url.match(/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
    if (m2) return `https://picsum.photos/seed/${t}_cover_${m2[1]}/${m2[2]}`;

    const m3 = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
    if (m3) {
      const r = url.match(/random=(\d+)/)?.[1] || '0';
      return `https://picsum.photos/seed/${t}_cover_${r}/${m3[1]}`;
    }

    return url;
  },

  onUnload() {
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
    this.setData({
      currentTime,
      progressPercent: duration > 0 ? (currentTime / duration) * 100 : 0
    });
    this.updateProgress();
  },

  onPlay() { this.setData({ isPlaying: true }); },
  onPause() { this.setData({ isPlaying: false }); },
  onEnded() { this.playNext(); },

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
    const speeds = [1, 1.5, 2, 2.5, 3];
    const index = speeds.indexOf(this.data.playbackRate);
    this.setData({ speedIndicatorPos: index >= 0 ? (index / (speeds.length - 1)) * 100 : 50 });
  },

  checkFavoriteStatus() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId || !app.globalData.userId) return;
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'checkFavorite', chapterId, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) this.setData({ isFavorite: res.result.data.isFavorite });
    }).catch(err => console.error('检查收藏状态失败:', err));
  },

  toggleTimeDisplay() {
    this.setData({ showTotalTime: !this.data.showTotalTime });
    this.updateProgress();
  },

  onSliderChanging(e) {
    const duration = this.bgAudioManager.duration;
    this.setData({ currentTime: (e.detail.value / 100) * duration });
    this.updateProgress();
  },

  onSliderChange(e) {
    const duration = this.bgAudioManager.duration;
    this.bgAudioManager.seek((e.detail.value / 100) * duration);
  },

  togglePlayPause() {
    if (this.bgAudioManager.paused) this.bgAudioManager.play();
    else this.bgAudioManager.pause();
  },

  rewind15() {
    this.bgAudioManager.seek(Math.max(0, this.bgAudioManager.currentTime - 15));
  },

  forward30() {
    this.bgAudioManager.seek(Math.min(this.bgAudioManager.duration, this.bgAudioManager.currentTime + 30));
  },

  playPrev() {
    const { currentIndex, chapters, playMode } = this.data;
    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }
    if (currentIndex > 0) this.playChapter(currentIndex - 1);
    else if (playMode === 'loop') this.playChapter(chapters.length - 1);
    else wx.showToast({ title: '已经是第一条', icon: 'none' });
  },

  playNext() {
    const { currentIndex, chapters, playMode } = this.data;
    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }
    if (currentIndex < chapters.length - 1) this.playChapter(currentIndex + 1);
    else if (playMode === 'loop') this.playChapter(0);
    else {
      this.bgAudioManager.stop();
      this.setData({ isPlaying: false });
    }
  },

  playChapter(index) {
    const { chapters } = this.data;
    if (index < 0 || index >= chapters.length) return;
    const chapter = chapters[index];
    if (!chapter.audioUrl) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
      return;
    }

    this.saveProgress();
    this.bgAudioManager.title = chapter.title;
    this.bgAudioManager.src = chapter.audioUrl;
    this.bgAudioManager.coverUrl = this.data.courseCover;
    this.bgAudioManager.episode = `${chapter.seq || index + 1}/${chapters.length}`;

    this.setData({ currentChapter: chapter, currentIndex: index });
    app.globalData.playingChapter = chapter;
    app.globalData.playingIndex = index;
    this.checkFavoriteStatus();
  },

  saveProgress() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId || !this.bgAudioManager.currentTime) return;
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'updateChapterProgress',
        chapterId,
        courseId: this.data.currentChapter.course,
        lastPlayTime: this.bgAudioManager.currentTime,
        finished: this.bgAudioManager.currentTime >= this.bgAudioManager.duration - 10,
        userId: app.globalData.userId
      }
    }).catch(err => console.error('保存进度失败:', err));
  },

  togglePlayMode() {
    const modes = ['sequence', 'loop', 'single'];
    const newMode = modes[(modes.indexOf(this.data.playMode) + 1) % modes.length];
    this.setData({ playMode: newMode });
    app.globalData.playMode = newMode;
    wx.showToast({ title: newMode === 'sequence' ? '顺序播放' : newMode === 'loop' ? '列表循环' : '单曲循环', icon: 'none' });
  },

  showPlaylist() {
    wx.showToast({ title: '播放列表功能开发中', icon: 'none' });
  },

  toggleSort() {
    const newOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc';
    const newChapters = [...this.data.chapters].reverse();
    this.setData({ sortOrder: newOrder, chapters: newChapters, currentIndex: newChapters.length - 1 - this.data.currentIndex });
    app.globalData.playlistSortOrder = newOrder;
    app.globalData.playlistChaptersData = newChapters;
  },

  toggleFavorite() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId) return;
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'toggleFavorite', chapterId, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        this.setData({ isFavorite: res.result.data.isFavorite });
        wx.showToast({ title: res.result.data.isFavorite ? '已收藏' : '已取消收藏', icon: 'success' });
      }
    }).catch(err => {
      console.error('切换收藏失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  setSpeed(e) {
    const rate = e.currentTarget.dataset.rate;
    this.bgAudioManager.playbackRate = rate;
    this.setData({ playbackRate: rate });
    this.updateSpeedIndicator();
  }
});