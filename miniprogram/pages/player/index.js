// player/index.js
const app = getApp();

Page({
  data: {
    courseCover: '', bgCover: '', bgCoverLoaded: false, bgPortraitLoaded: false,
    bgCoverError: false, coverError: false, courseTitle: '', courseAuthor: '',
    chapterCount: 0, currentChapter: {}, currentIndex: 0, chapters: [], course: {},
    isPlaying: false, currentTime: 0, duration: 0, progressPercent: 0,
    currentTimeText: '0:00', remainingTimeText: '-0:00', showTotalTime: false,
    playbackRate: 2, playMode: 'sequence', sortOrder: 'asc', isFavorite: false,
    speedIndicatorPos: 70, coverRotationAngle: 0, coverLoadTime: 0,
    nextChapterSeq: '', nextChapterTitle: '', usingDefaultCover: false,
    originalCover: '', isFavoriteList: false
  },

  bgAudioManager: null,
  speedOptions: [0.75, 1, 1.25, 1.5, 2],
  audioCallbacks: null,
  chapterCallback: null,

  onLoad() {
    this.bgAudioManager = app.bgAudioManager;
    this.setupAudioEvents();

    this.chapterCallback = {
      onChapterChange: ({ chapterId, chapter, index }) => {
        const chapters = this.data.chapters;
        const foundChapter = chapter || chapters.find(ch => ch._id === chapterId);
        const foundIndex = index >= 0 ? index : chapters.findIndex(ch => ch._id === chapterId);
        if (foundIndex >= 0 && foundChapter) {
          this.setData({
            currentChapter: foundChapter, currentIndex: foundIndex,
            courseTitle: foundChapter.courseTitle || this.data.courseTitle,
            courseAuthor: foundChapter.author || this.data.courseAuthor
          }, () => this.updateNextChapterInfo());
        }
      },
      onPlayModeChange: ({ playMode }) => {
        this.setData({ playMode });
        this.updateNextChapterInfo();
      },
      onLastChapterEnded: () => {
        this.setData({ isPlaying: false, currentTime: 0, duration: 0, progressPercent: 0 });
        this.stopCoverRotation();
      }
    };
    app.registerMiniPlayer(this.chapterCallback);

    const coverLoadTime = app.globalData.coverLoadTime || Date.now();
    const { playingCourse, playingChapter, playingSeq, playlistChaptersData, playlistSortOrder, playMode } = app.globalData;

    let courseCover = app.processImageUrl(playingCourse?.cover || '', 'cover', coverLoadTime);
    let bgCover = app.processImageUrl(playingCourse?.cover || '', 'cover', coverLoadTime);
    if (!courseCover && app.globalData.defaultCoverUrl) {
      courseCover = app.globalData.defaultCoverUrl;
      bgCover = app.globalData.defaultCoverUrl;
    }

    const chapters = playlistChaptersData || [];
    const currentChapter = playingChapter || chapters.find(ch => ch.seq === playingSeq) || {};
    const currentIndex = chapters.findIndex(ch => ch._id === currentChapter._id);
    const firstChapter = chapters[0];
    const isFavList = !!(firstChapter?.courseTitle);
    const course = playingCourse?.title && !isFavList ? playingCourse : {
      _id: firstChapter?.course || playingCourse?._id || '',
      title: firstChapter?.courseTitle || playingCourse?.title || '',
      cover: firstChapter?.courseCover || playingCourse?.cover || '',
      author: firstChapter?.author || playingCourse?.author || '',
      chapterCount: chapters.length || 0
    };

    this.setData({
      courseCover, bgCover, originalCover: playingCourse?.cover || '',
      courseTitle: course.title, courseAuthor: course.author || '', chapterCount: course.chapterCount,
      currentChapter, currentIndex: currentIndex >= 0 ? currentIndex : 0,
      chapters, course, sortOrder: playlistSortOrder || 'asc',
      playMode: playMode || 'sequence',
      isPlaying: !this.bgAudioManager.paused,
      currentTime: this.bgAudioManager.currentTime || 0,
      duration: this.bgAudioManager.duration || 0,
      playbackRate: this.bgAudioManager.playbackRate || 2,
      coverLoadTime, isFavoriteList: isFavList
    });

    this.updateProgress();
    this.updateSpeedIndicator();
    this.checkFavoriteStatus();
    this.updateNextChapterInfo();
    if (!this.bgAudioManager.paused) this.startCoverRotation();
  },

  onShow() {
    this.syncImageTimes();
    this.syncPlaybackState();
    const { playlistChaptersData, playlistSortOrder, playingChapter, playingCourse } = app.globalData;
    if (playlistChaptersData && playlistChaptersData.length > 0) {
      const currentId = playingChapter?._id || this.data.currentChapter?._id;
      const newIndex = playlistChaptersData.findIndex(ch => ch._id === currentId);
      const newChapter = newIndex >= 0 ? playlistChaptersData[newIndex] : this.data.currentChapter;
      const firstChapter = playlistChaptersData[0];
      const updatedCourse = playingCourse?.title ? playingCourse : {
        _id: firstChapter.course, title: firstChapter.courseTitle || playingCourse?.title || '',
        cover: firstChapter.courseCover || playingCourse?.cover || '',
        author: firstChapter.author || playingCourse?.author || '',
        chapterCount: playlistChaptersData.length
      };
      const isFavList = !!(firstChapter.courseTitle);
      this.setData({
        chapters: playlistChaptersData, sortOrder: playlistSortOrder || 'asc',
        currentIndex: newIndex >= 0 ? newIndex : this.data.currentIndex,
        currentChapter: newChapter, course: updatedCourse, isFavoriteList: isFavList
      });
    }
  },

  syncPlaybackState() {
    const isPlaying = !this.bgAudioManager.paused;
    const currentTime = this.bgAudioManager.currentTime || 0;
    const duration = this.bgAudioManager.duration || 0;
    const playbackRate = this.bgAudioManager.playbackRate || 2;
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const rotationCycle = 12000;
    const currentTimeMs = currentTime * 1000;
    const elapsedInCycle = currentTimeMs % rotationCycle;
    let coverRotationAngle = (elapsedInCycle / rotationCycle) * 360;
    if (this.data.sortOrder === 'desc') coverRotationAngle = -coverRotationAngle;

    this.setData({ isPlaying, currentTime, duration, playbackRate, progressPercent, coverRotationAngle });
    this.updateProgress();
    this.updateSpeedIndicator();
    if (isPlaying) this.startCoverRotation();
    else this.stopCoverRotation();
  },

  syncImageTimes() {
    const ct = app.globalData.coverLoadTime;
    if (ct && ct !== this.data.coverLoadTime) {
      const coverUrl = app.globalData.playingCourse?.cover || '';
      let courseCover = coverUrl ? app.processImageUrl(coverUrl, 'cover', ct) : '';
      let bgCover = courseCover;
      if (!courseCover && app.globalData.defaultCoverUrl) {
        courseCover = app.globalData.defaultCoverUrl;
        bgCover = app.globalData.defaultCoverUrl;
      }
      this.setData({ coverLoadTime: ct, courseCover, bgCover });
    }
  },

  onUnload() {
    if (this.audioCallbacks) {
      if (this.bgAudioManager.offTimeUpdate) this.bgAudioManager.offTimeUpdate(this.audioCallbacks.onTimeUpdate);
      if (this.bgAudioManager.offPlay) this.bgAudioManager.offPlay(this.audioCallbacks.onPlay);
      if (this.bgAudioManager.offPause) this.bgAudioManager.offPause(this.audioCallbacks.onPause);
      if (this.bgAudioManager.offEnded) this.bgAudioManager.offEnded(this.audioCallbacks.onEnded);
      if (this.bgAudioManager.offCanplay) this.bgAudioManager.offCanplay(this.audioCallbacks.onCanplay);
    }
    this.stopCoverRotation();
    if (this.chapterCallback) app.unregisterMiniPlayer(this.chapterCallback);
  },

  setupAudioEvents() {
    this.audioCallbacks = {
      onTimeUpdate: () => this.onTimeUpdate(),
      onPlay: () => { this._syncingChapter = false; this.setData({ isPlaying: true }); this.startCoverRotation(); },
      onPause: () => { if (this.data.currentChapter._id) this._doSaveProgress(); this.setData({ isPlaying: false }); this.stopCoverRotation(); },
      onEnded: () => app.onAudioEnded(),
      onCanplay: () => { this.bgAudioManager.playbackRate = 2; this.setData({ duration: this.bgAudioManager.duration, playbackRate: 2 }); }
    };
    this.bgAudioManager.onTimeUpdate(this.audioCallbacks.onTimeUpdate);
    this.bgAudioManager.onPlay(this.audioCallbacks.onPlay);
    this.bgAudioManager.onPause(this.audioCallbacks.onPause);
    this.bgAudioManager.onEnded(this.audioCallbacks.onEnded);
    this.bgAudioManager.onCanplay(this.audioCallbacks.onCanplay);
  },

  onTimeUpdate() {
    if (this._syncingChapter || this._sliderDragging) return;
    const currentTime = this.bgAudioManager.currentTime;
    const duration = this.bgAudioManager.duration;
    this.setData({ currentTime, duration, progressPercent: duration > 0 ? (currentTime / duration) * 100 : 0 });
    this.updateProgress();
  },

  onBgCoverLoad() { this.setData({ bgCoverLoaded: true }); },
  onBgPortraitLoad() { this.setData({ bgPortraitLoaded: true }); },

  onBgCoverError() {
    const defaultCover = app.globalData.defaultCoverLocalPath || app.globalData.defaultCoverUrl || '';
    if (this.data.courseCover === defaultCover && defaultCover) {
      this.setData({ bgCoverError: true, courseCover: '', bgCover: '' });
      return;
    }
    this.setData({ bgCoverError: true, courseCover: defaultCover || this.data.courseCover, bgCover: defaultCover || this.data.bgCover });
  },

  onCoverError() {
    const defaultCover = app.globalData.defaultCoverLocalPath || app.globalData.defaultCoverUrl || '';
    if (this.data.courseCover === defaultCover && defaultCover) {
      this.setData({ coverError: true, courseCover: '' });
      return;
    }
    this.setData({ coverError: true, courseCover: defaultCover || this.data.courseCover });
  },

  onCoverTap() {
    const { usingDefaultCover, originalCover } = this.data;
    const defaultCover = app.globalData.defaultCoverLocalPath || app.globalData.defaultCoverUrl || '';
    if (!defaultCover || !originalCover) return;
    if (usingDefaultCover) {
      this.setData({ usingDefaultCover: false, courseCover: app.processImageUrl(originalCover, 'cover', this.data.coverLoadTime), coverError: false, bgCoverError: false });
    } else {
      this.setData({ usingDefaultCover: true, courseCover: defaultCover, coverError: false, bgCoverError: false });
    }
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
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  },

  updateSpeedIndicator() {
    const { playbackRate } = this.data;
    const index = this.speedOptions.findIndex(s => Math.abs(s - playbackRate) < 0.01);
    this.setData({ speedIndicatorPos: index >= 0 ? 10 + index * 20 : 50 });
  },

  checkFavoriteStatus() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId || !app.globalData.userId) return;
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'checkFavorite', chapterId, userId: app.globalData.userId }
    }).then(res => { if (res.result.success) this.setData({ isFavorite: res.result.data.isFavorite }); })
      .catch(err => console.error('检查收藏状态失败:', err));
  },

  toggleTimeDisplay() {
    this.setData({ showTotalTime: !this.data.showTotalTime });
    this.updateProgress();
  },

  onSliderChanging(e) {
    this._sliderDragging = true;
    const duration = this.bgAudioManager.duration;
    this.setData({ currentTime: (e.detail.value / 100) * duration });
    this.updateProgress();
  },

  onSliderChange(e) {
    const duration = this.bgAudioManager.duration;
    this.bgAudioManager.seek((e.detail.value / 100) * duration);
    this._sliderDragging = false;
  },

  togglePlayPause() { app.togglePlayPause(); },
  rewind15() { this.bgAudioManager.seek(Math.max(0, this.bgAudioManager.currentTime - 15)); },
  forward30() { this.bgAudioManager.seek(Math.min(this.bgAudioManager.duration, this.bgAudioManager.currentTime + 30)); },

  playPrev() {
    if (this.data.currentChapter._id) this._doSaveProgress();
    app.playPrev();
  },

  playNext() {
    if (this.data.currentChapter._id) this._doSaveProgress();
    app.playNext();
  },

  playChapter(index) {
    const { chapters } = this.data;
    if (index < 0 || index >= chapters.length) return;
    const chapter = chapters[index];
    if (!chapter.audioUrl) return wx.showToast({ title: '暂无音频', icon: 'none' });
    this._doSaveProgress();
    app.playChapter(chapter._id, chapters);
    this.checkFavoriteStatus();
    this.updateNextChapterInfo();
  },

  _doSaveProgress() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId || !this.bgAudioManager.currentTime) return Promise.resolve();
    const lastPlayTime = this.bgAudioManager.currentTime;
    const finished = lastPlayTime >= this.bgAudioManager.duration - 10;
    return app.saveProgress(chapterId, this.data.currentChapter.course || this.data.course._id, lastPlayTime, finished);
  },

  saveProgress() { return this._doSaveProgress(); },

  togglePlayMode() {
    const nextMode = app.togglePlayMode();
    this.setData({ playMode: nextMode });
    this.updateNextChapterInfo();
    wx.showToast({ title: nextMode === 'sequence' ? '顺序播放' : nextMode === 'loop' ? '列表循环' : '单曲循环', icon: 'none' });
  },

  showPlaylist() {
    const playlistPanel = this.selectComponent('#playerPlaylistPanel');
    if (playlistPanel) playlistPanel.show();
  },

  onPlaylistPlay(e) {
    const { chapterId, index } = e.detail;
    if (chapterId === this.data.currentChapter._id) { app.togglePlayPause(); return; }
    const chapter = this.data.chapters.find(ch => ch._id === chapterId);
    if (chapter?.audioUrl) { this._doSaveProgress(); app.playChapter(chapterId, this.data.chapters); this.checkFavoriteStatus(); this.updateNextChapterInfo(); }
  },

  onPlaylistDelete(e) {
    const { chapterId } = e.detail;
    const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
    const withIndex = chapters.map((ch, idx) => ({ ...ch, index: idx }));
    const currentId = this.data.currentChapter?._id;
    const currentIdx = this.data.currentIndex;
    this.setData({ chapters: withIndex }, () => this.updateNextChapterInfo());
    app.globalData.playlistChaptersData = withIndex;

    if (chapterId === currentId) {
      this._doSaveProgress();
      if (currentIdx < withIndex.length && withIndex[currentIdx]?.audioUrl) {
        app.playChapter(withIndex[currentIdx]._id, withIndex);
      } else if (withIndex.length > 0) {
        app.playChapter(withIndex[withIndex.length - 1]._id, withIndex);
      } else {
        app.stop(); this.setData({ isPlaying: false });
      }
    }
  },

  onPlaylistCollapse() {},
  onPlaylistClear() {
    this._doSaveProgress();
    app.stop();
    this.setData({ isPlaying: false, chapters: [], currentChapter: {}, currentIndex: 0 });
    Object.assign(app.globalData, { miniPlayerActive: false, playingCourse: null, playingChapter: null, playingSeq: null, playingIndex: 0, playlistChaptersData: [] });
  },

  onPlaylistSyncSort(e) {
    const { chapters, sortOrder } = e.detail;
    const currentId = this.data.currentChapter._id;
    const newIndex = chapters.findIndex(ch => ch._id === currentId);
    this.setData({ chapters, currentIndex: newIndex, sortOrder }, () => this.updateNextChapterInfo());
    app.globalData.playingIndex = newIndex;
    app.globalData.playlistChaptersData = chapters;
    app.globalData.playlistSortOrder = sortOrder;
  },

  onPlaylistModeChange(e) {
    this.setData({ playMode: e.detail.playMode });
    app.globalData.playMode = e.detail.playMode;
  },

  toggleSort() {
    const { sortOrder, chapters, currentChapter } = this.data;
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const reversed = [...chapters].reverse().map((ch, idx) => ({ ...ch, index: idx }));
    const currentId = currentChapter?._id;
    const newIndex = reversed.findIndex(ch => ch._id === currentId);
    const newCurrentChapter = reversed[newIndex];
    Object.assign(app.globalData, { playlistSortOrder: newOrder, playlistChaptersData: reversed, playingIndex: newIndex >= 0 ? newIndex : 0 });
    this.setData({ sortOrder: newOrder, chapters: reversed, currentIndex: newIndex >= 0 ? newIndex : 0, currentChapter: newCurrentChapter || currentChapter }, () => this.updateNextChapterInfo());
    wx.showToast({ title: newOrder === 'asc' ? '正序' : '倒序', icon: 'none' });
  },

  toggleFavorite() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId) return;
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'toggleFavorite', chapterId, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) { this.setData({ isFavorite: res.result.data.isFavorite }); wx.showToast({ title: res.result.data.isFavorite ? '已收藏' : '已取消收藏', icon: 'none' }); }
    }).catch(() => wx.showToast({ title: '操作失败', icon: 'none' }));
  },

  updateNextChapterInfo() {
    const { chapters, playMode, currentChapter } = this.data;
    if (!chapters || chapters.length === 0) { this.setData({ nextChapterSeq: '', nextChapterTitle: '' }); return; }
    if (playMode === 'single') { this.setData({ nextChapterSeq: currentChapter.seq, nextChapterTitle: currentChapter.title }); return; }
    const currentIdx = chapters.findIndex(ch => ch._id === currentChapter?._id);
    const nextIndex = currentIdx + 1;
    if (nextIndex < chapters.length) {
      const nextCh = chapters[nextIndex];
      this.setData({ nextChapterSeq: nextCh.seq, nextChapterTitle: nextCh.title });
    } else if (playMode === 'loop') {
      this.setData({ nextChapterSeq: chapters[0].seq, nextChapterTitle: chapters[0].title });
    } else {
      this.setData({ nextChapterSeq: '', nextChapterTitle: '已经是最后一条' });
    }
  },

  startCoverRotation() {
    if (this.rotationTimer) return;
    this.rotationTimer = setInterval(() => {
      const { coverRotationAngle, sortOrder } = this.data;
      const newAngle = sortOrder === 'asc' ? coverRotationAngle + 1.5 : coverRotationAngle - 1.5;
      this.setData({ coverRotationAngle: newAngle });
    }, 50);
  },

  stopCoverRotation() {
    if (this.rotationTimer) { clearInterval(this.rotationTimer); this.rotationTimer = null; }
  },

  onSpeedTrackTap(e) {
    if (this.speedMoved) { this.speedMoved = false; return; }
    const touch = e.detail.x ? e : e.touches?.[0] || e;
    const clientX = touch.clientX || touch.detail?.x || 0;
    const query = this.createSelectorQuery();
    query.select('.speed-track-wrap').boundingClientRect((rect) => {
      if (!rect) return;
      const x = clientX - rect.left;
      const pos = Math.max(10, Math.min(90, (x / rect.width) * 100));
      const index = Math.round((pos - 10) / 20);
      const rate = this.speedOptions[Math.max(0, Math.min(this.speedOptions.length - 1, index))];
      this.setData({ playbackRate: rate });
      this.bgAudioManager.playbackRate = rate;
      this.updateSpeedIndicator();
    }).exec();
  },

  onSpeedTouchStart(e) { this.speedTouching = true; this.speedTouchStartX = e.touches[0].clientX; this.speedMoved = false; },

  onSpeedTouchMove(e) {
    if (!this.speedTouching) return;
    if (Math.abs(e.touches[0].clientX - this.speedTouchStartX) > 10) this.speedMoved = true;
    const query = this.createSelectorQuery();
    query.select('.speed-track-wrap').boundingClientRect((rect) => {
      if (!rect) return;
      const x = e.touches[0].clientX - rect.left;
      const pos = Math.max(10, Math.min(90, (x / rect.width) * 100));
      const index = Math.round((pos - 10) / 20);
      const rate = this.speedOptions[Math.max(0, Math.min(this.speedOptions.length - 1, index))];
      this.setData({ playbackRate: rate });
      this.bgAudioManager.playbackRate = rate;
      this.updateSpeedIndicator();
    }).exec();
  },

  onSpeedTouchEnd() { this.speedTouching = false; }
});