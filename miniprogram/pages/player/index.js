// player/index.js
const app = getApp();

Page({
  data: {
    courseCover: '',
    bgCover: '', // 竖屏比例背景图
    bgCoverLoaded: false, // 封面背景加载状态
    bgPortraitLoaded: false, // 竖屏背景加载状态
    courseTitle: '',
    courseAuthor: '',
    chapterCount: 0,
    currentChapter: {},
    currentIndex: 0,
    chapters: [],
    course: {},
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
    speedIndicatorPos: 70,
    coverRotationAngle: 0,
    coverLoadTime: 0,
    nextChapterSeq: '',
    nextChapterTitle: ''
  },

  bgAudioManager: null,
  speedOptions: [0.75, 1, 1.25, 1.5, 2],
  audioCallbacks: null, // 保存音频事件回调引用

  onLoad() {
    this.bgAudioManager = app.bgAudioManager;
    this.setupAudioEvents();

    const coverLoadTime = app.globalData.coverLoadTime || Date.now();
    const { playingCourse, playingChapter, playingIndex, playlistChaptersData, playlistSortOrder, playMode } = app.globalData;

    // 处理封面URL，如果没有封面则使用默认封面
    let courseCover = this.processImageUrl(playingCourse?.cover || '', coverLoadTime);
    let bgCover = this.generateBgCoverUrl(playingCourse?.cover || '', coverLoadTime);

    // 如果没有封面，使用默认封面
    if (!courseCover && app.globalData.defaultCoverUrl) {
      courseCover = app.globalData.defaultCoverUrl;
      bgCover = app.globalData.defaultCoverUrl;
    }

    this.setData({
      courseCover,
      bgCover,
      courseTitle: playingCourse?.title || '',
      courseAuthor: playingCourse?.author || '',
      chapterCount: playingCourse?.chapterCount || playlistChaptersData?.length || 0,
      currentChapter: playingChapter || {},
      currentIndex: playingIndex || 0,
      chapters: playlistChaptersData || [],
      course: playingCourse || {},
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
    this.updateNextChapterInfo();

    // 如果正在播放，启动封面旋转
    if (!this.bgAudioManager.paused) {
      this.startCoverRotation();
    }
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

  // 生成竖屏比例背景图URL（与封面图使用相同seed，只改变尺寸）
  generateBgCoverUrl(url, coverLoadTime) {
    if (!url) return url;
    const t = coverLoadTime || app.globalData.coverLoadTime || Date.now();

    // 如果是固定图片，直接返回
    if (url.includes('seed/fixed_')) return url;

    // picsum.photos：使用相同seed，只改变尺寸为竖屏比例
    if (url.includes('picsum.photos')) {
      // 提取原始seed信息
      const seedMatch = url.match(/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        // 保留原有seed，只改变尺寸为 750x1200（竖屏比例）
        return `https://picsum.photos/seed/${seedMatch[1]}/750/1200`;
      }

      // 尝试从 random 参数提取
      const randomMatch = url.match(/random=(\d+)/);
      const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
      if (sizeMatch) {
        const r = randomMatch ? randomMatch[1] : '0';
        // 使用和封面图相同的时间戳+random组合作为seed
        return `https://picsum.photos/seed/${t}_cover_${r}/750/1200`;
      }
    }

    return url;
  },

  onUnload() {
    // 检查方法存在再取消监听（兼容低版本基础库）
    if (this.audioCallbacks) {
      if (this.bgAudioManager.offTimeUpdate) {
        this.bgAudioManager.offTimeUpdate(this.audioCallbacks.onTimeUpdate);
      }
      if (this.bgAudioManager.offPlay) {
        this.bgAudioManager.offPlay(this.audioCallbacks.onPlay);
      }
      if (this.bgAudioManager.offPause) {
        this.bgAudioManager.offPause(this.audioCallbacks.onPause);
      }
      if (this.bgAudioManager.offEnded) {
        this.bgAudioManager.offEnded(this.audioCallbacks.onEnded);
      }
    }
    this.stopCoverRotation();
  },

  setupAudioEvents() {
    // 保存回调引用以便正确取消监听
    this.audioCallbacks = {
      onTimeUpdate: () => this.onTimeUpdate(),
      onPlay: () => this.onPlay(),
      onPause: () => this.onPause(),
      onEnded: () => this.onEnded()
    };
    this.bgAudioManager.onTimeUpdate(this.audioCallbacks.onTimeUpdate);
    this.bgAudioManager.onPlay(this.audioCallbacks.onPlay);
    this.bgAudioManager.onPause(this.audioCallbacks.onPause);
    this.bgAudioManager.onEnded(this.audioCallbacks.onEnded);
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

  onPlay() {
    this.setData({ isPlaying: true });
    this.startCoverRotation();
  },
  onPause() {
    this.setData({ isPlaying: false });
    this.stopCoverRotation();
  },
  onEnded() { this.playNext(); },

  // 背景图加载回调
  onBgCoverLoad() {
    this.setData({ bgCoverLoaded: true });
  },

  onBgPortraitLoad() {
    this.setData({ bgPortraitLoaded: true });
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
    const speeds = this.speedOptions;
    let index = -1;
    for (let i = 0; i < speeds.length; i++) {
      if (Math.abs(speeds[i] - playbackRate) < 0.01) {
        index = i;
        break;
      }
    }
    // 位置分布：约10%, 30%, 50%, 70%, 90%
    if (index >= 0) {
      const pos = 10 + index * 20;
      this.setData({ speedIndicatorPos: pos });
    } else {
      this.setData({ speedIndicatorPos: 50 });
    }
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
    this.setData({ currentChapter: chapter, currentIndex: index });
    app.globalData.playingChapter = chapter;
    app.globalData.playingIndex = index;
    this.loadAudio(chapter);
    this.checkFavoriteStatus();
    this.updateNextChapterInfo();
  },

  async loadAudio(chapter) {
    const bgAudio = this.bgAudioManager;
    const src = chapter?.audioUrl;

    if (!src) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
      this.setData({ isPlaying: false });
      return;
    }

    if (src.startsWith('cloud://')) {
      try {
        wx.showLoading({ title: '加载中...', mask: true });
        const res = await wx.cloud.getTempFileURL({ fileList: [src] });
        wx.hideLoading();
        const tempUrl = res.fileList?.[0]?.tempFileURL;
        if (!tempUrl) throw new Error('获取链接失败');
        this.playWithUrl(chapter, tempUrl);
      } catch (err) {
        wx.hideLoading();
        wx.showToast({ title: '音频加载失败', icon: 'none' });
        this.setData({ isPlaying: false });
      }
    } else {
      this.playWithUrl(chapter, src);
    }
  },

  playWithUrl(chapter, src) {
    const bgAudio = this.bgAudioManager;
    const [baseUrl, query] = src.split('?');
    bgAudio.title = chapter.title || '音频课程';
    bgAudio.epname = this.data.courseTitle || '';
    bgAudio.coverImgUrl = this.data.courseCover || '';
    const lastPlayTime = Number(chapter.lastPlayTime) || 0;
    const duration = Number(chapter.duration) || 0;
    const startTime = (lastPlayTime >= duration && duration > 0) ? 0 : lastPlayTime;
    bgAudio.startTime = startTime;
    bgAudio.src = query ? `${encodeURI(baseUrl)}?${query}` : encodeURI(baseUrl);
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
    this.updateNextChapterInfo();
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
    this.updateNextChapterInfo();
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

  // 更新下一条信息
  updateNextChapterInfo() {
    const { chapters, currentIndex, playMode } = this.data;
    if (!chapters || chapters.length === 0) {
      this.setData({ nextChapterSeq: '', nextChapterTitle: '' });
      return;
    }
    // 单曲循环模式：下一条就是当前条
    if (playMode === 'single') {
      const current = chapters[currentIndex];
      this.setData({ nextChapterSeq: current.seq, nextChapterTitle: current.title });
      return;
    }
    // 列表循环模式：最后一条的下一条是第一条
    if (playMode === 'loop' && currentIndex === chapters.length - 1) {
      const first = chapters[0];
      this.setData({ nextChapterSeq: first.seq, nextChapterTitle: first.title });
      return;
    }
    // 顺序播放模式：最后一条显示提示
    if (currentIndex === chapters.length - 1) {
      this.setData({ nextChapterSeq: '', nextChapterTitle: '已经是最后一条' });
      return;
    }
    // 其他情况：显示下一条
    const next = chapters[currentIndex + 1];
    this.setData({ nextChapterSeq: next.seq, nextChapterTitle: next.title });
  },

  // 开始封面旋转（根据排序方向）
  startCoverRotation() {
    if (this.rotationTimer) return; // 已在旋转
    // 每50ms更新一次角度，12秒一圈 = 360/(12*1000/50) = 1.5度每次
    const rotationSpeed = 1.5;
    this.rotationTimer = setInterval(() => {
      const { coverRotationAngle, sortOrder } = this.data;
      // 正序顺时针（角度增加），倒序逆时针（角度减少）
      const newAngle = sortOrder === 'asc'
        ? coverRotationAngle + rotationSpeed
        : coverRotationAngle - rotationSpeed;
      this.setData({ coverRotationAngle: newAngle });
    }, 50);
  },

  // 停止封面旋转（保持当前角度）
  stopCoverRotation() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  },

  // 倍速条点击（根据点击位置选择倍速）
  onSpeedTrackTap(e) {
    if (this.speedMoved) {
      this.speedMoved = false;
      return;
    }

    const touch = e.detail.x ? e : e.touches?.[0] || e;
    const clientX = touch.clientX || touch.detail?.x || 0;

    const query = this.createSelectorQuery();
    query.select('.speed-track-wrap').boundingClientRect((rect) => {
      if (!rect) return;
      const x = clientX - rect.left;
      const width = rect.width;
      const pos = Math.max(10, Math.min(90, (x / width) * 100));
      const speeds = this.speedOptions;
      const index = Math.round((pos - 10) / 20);
      const clampedIndex = Math.max(0, Math.min(speeds.length - 1, index));
      const rate = speeds[clampedIndex];
      this.setData({ playbackRate: rate });
      this.bgAudioManager.playbackRate = rate;
      this.updateSpeedIndicator();
    }).exec();
  },

  // 倍速滑动开始
  onSpeedTouchStart(e) {
    this.speedTouching = true;
    this.speedTouchStartX = e.touches[0].clientX;
    this.speedMoved = false;
  },

  // 倍速滑动移动
  onSpeedTouchMove(e) {
    if (!this.speedTouching) return;
    const moveDistance = Math.abs(e.touches[0].clientX - this.speedTouchStartX);
    if (moveDistance > 10) {
      this.speedMoved = true;
    }

    const touch = e.touches[0];
    const query = this.createSelectorQuery();
    query.select('.speed-track-wrap').boundingClientRect((rect) => {
      if (!rect) return;
      const x = touch.clientX - rect.left;
      const width = rect.width;
      const pos = Math.max(10, Math.min(90, (x / width) * 100));
      const speeds = this.speedOptions;
      const index = Math.round((pos - 10) / 20);
      const clampedIndex = Math.max(0, Math.min(speeds.length - 1, index));
      const rate = speeds[clampedIndex];
      this.setData({ playbackRate: rate });
      this.bgAudioManager.playbackRate = rate;
      this.updateSpeedIndicator();
    }).exec();
  },

  // 倍速滑动结束
  onSpeedTouchEnd() {
    this.speedTouching = false;
  }
});