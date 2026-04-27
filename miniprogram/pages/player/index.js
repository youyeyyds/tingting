// player/index.js
const app = getApp();

Page({
  data: {
    courseCover: '',
    bgCover: '', // 竖屏比例背景图
    bgCoverLoaded: false, // 封面背景加载状态
    bgPortraitLoaded: false, // 竖屏背景加载状态
    bgCoverError: false, // 背景图加载失败状态
    coverError: false, // 封面图加载失败状态
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
    nextChapterTitle: '',
    usingDefaultCover: false,
    originalCover: ''
  },

  bgAudioManager: null,
  speedOptions: [0.75, 1, 1.25, 1.5, 2],
  audioCallbacks: null, // 保存音频事件回调引用
  chapterCallback: null, // 保存章节变化回调引用

  onLoad() {
    this.bgAudioManager = app.bgAudioManager;
    this.setupAudioEvents();

    // 注册章节变化回调
    this.chapterCallback = {
      onChapterChange: ({ chapterId }) => {
        const chapters = this.data.chapters;
        const index = chapters.findIndex(ch => ch._id === chapterId);
        if (index >= 0) {
          const chapter = chapters[index];
          this.setData({ currentChapter: chapter, currentIndex: index });
        }
      }
    };
    app.registerMiniPlayer(this.chapterCallback);

    const coverLoadTime = app.globalData.coverLoadTime || Date.now();
    const { playingCourse, playingChapter, playingSeq, playingIndex, playlistChaptersData, playlistSortOrder, playMode } = app.globalData;

    // 处理封面URL，如果没有封面则使用默认封面
    let courseCover = this.processImageUrl(playingCourse?.cover || '', coverLoadTime);
    let bgCover = this.generateBgCoverUrl(playingCourse?.cover || '', coverLoadTime);

    // 如果没有封面，使用默认封面
    if (!courseCover && app.globalData.defaultCoverUrl) {
      courseCover = app.globalData.defaultCoverUrl;
      bgCover = app.globalData.defaultCoverUrl;
    }

    // 通过 playingSeq 找到 currentChapter 和 currentIndex
    const chapters = playlistChaptersData || [];
    const currentChapter = playingChapter || chapters.find(ch => ch.seq === playingSeq) || {};
    const currentIndex = chapters.findIndex(ch => ch._id === currentChapter._id);

    this.setData({
      courseCover,
      bgCover,
      originalCover: playingCourse?.cover || '',
      courseTitle: playingCourse?.title || '',
      courseAuthor: playingCourse?.author || '',
      chapterCount: playingCourse?.chapterCount || chapters.length || 0,
      currentChapter: currentChapter,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      chapters: chapters,
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

  onShow() {
    // 同步封面图片时间戳变化
    this.syncImageTimes();
    // 同步播放状态
    this.syncPlaybackState();
    // 同步播放列表数据（从 globalData 读取最新的播放列表和排序）
    const { playlistChaptersData, playlistSortOrder, playingChapter } = app.globalData;
    if (playlistChaptersData && playlistChaptersData.length > 0) {
      const currentId = playingChapter?._id || this.data.currentChapter?._id;
      const newIndex = playlistChaptersData.findIndex(ch => ch._id === currentId);
      const newChapter = newIndex >= 0 ? playlistChaptersData[newIndex] : this.data.currentChapter;
      this.setData({
        chapters: playlistChaptersData,
        sortOrder: playlistSortOrder || 'asc',
        currentIndex: newIndex >= 0 ? newIndex : this.data.currentIndex,
        currentChapter: newChapter
      });
    }
  },

  // 同步播放状态
  syncPlaybackState() {
    const isPlaying = !this.bgAudioManager.paused;
    const currentTime = this.bgAudioManager.currentTime || 0;
    const duration = this.bgAudioManager.duration || 0;
    const playbackRate = this.bgAudioManager.playbackRate || 2;
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const { sortOrder } = this.data;

    // 根据当前播放时间和排序方向计算封面旋转角度
    // 每12秒完成一圈，每50ms旋转1.5度
    // 注意：currentTime 的单位是秒，rotationCycle 的单位是毫秒，需要转换
    const rotationCycle = 12000; // 一圈的时间（毫秒）
    const currentTimeMs = currentTime * 1000; // 转换为毫秒
    const elapsedInCycle = currentTimeMs % rotationCycle;
    let coverRotationAngle = (elapsedInCycle / rotationCycle) * 360;
    if (sortOrder === 'desc') {
      coverRotationAngle = -coverRotationAngle;
    }

    this.setData({
      isPlaying,
      currentTime,
      duration,
      playbackRate,
      progressPercent,
      coverRotationAngle
    });
    this.updateProgress();
    this.updateSpeedIndicator();

    // 如果正在播放，启动封面旋转；否则停止
    if (isPlaying) {
      this.startCoverRotation();
    } else {
      this.stopCoverRotation();
    }
  },

  // 同步封面图片（其他页面刷新后返回需要更新图片）
  syncImageTimes() {
    const ct = app.globalData.coverLoadTime;
    if (ct && ct !== this.data.coverLoadTime) {
      const { playingCourse } = app.globalData;
      const coverUrl = playingCourse?.cover || '';
      // 封面和背景图都用 processImageUrl 处理，保持一致
      let courseCover = coverUrl ? this.processImageUrl(coverUrl, ct) : '';
      let bgCover = coverUrl ? this.processImageUrl(coverUrl, ct) : '';
      // 如果没有封面，使用默认封面
      if (!courseCover && app.globalData.defaultCoverUrl) {
        courseCover = app.globalData.defaultCoverUrl;
        bgCover = app.globalData.defaultCoverUrl;
      }
      this.setData({ coverLoadTime: ct, courseCover, bgCover });
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
      if (this.bgAudioManager.offCanplay) {
        this.bgAudioManager.offCanplay(this.audioCallbacks.onCanplay);
      }
    }
    this.stopCoverRotation();
    if (this.chapterCallback) {
      app.unregisterMiniPlayer(this.chapterCallback);
    }
  },

  setupAudioEvents() {
    // 保存回调引用以便正确取消监听
    this.audioCallbacks = {
      onTimeUpdate: () => this.onTimeUpdate(),
      onPlay: () => this.onPlay(),
      onPause: () => this.onPause(),
      onEnded: () => this.onEnded(),
      onCanplay: () => this.onCanplay()
    };
    this.bgAudioManager.onTimeUpdate(this.audioCallbacks.onTimeUpdate);
    this.bgAudioManager.onPlay(this.audioCallbacks.onPlay);
    this.bgAudioManager.onPause(this.audioCallbacks.onPause);
    this.bgAudioManager.onEnded(this.audioCallbacks.onEnded);
    this.bgAudioManager.onCanplay(this.audioCallbacks.onCanplay);
  },

  onTimeUpdate() {
    // 如果正在同步章节，保持当前设置的进度，不受 bgAudioManager.currentTime 变化影响
    if (this._syncingChapter) return;
    const currentTime = this.bgAudioManager.currentTime;
    const duration = this.bgAudioManager.duration;
    this.setData({
      currentTime,
      duration,
      progressPercent: duration > 0 ? (currentTime / duration) * 100 : 0
    });
    this.updateProgress();
  },

  onCanplay() {
    // 设置默认2倍速，只更新 duration，不更新 currentTime（等待 onPlay 时再更新）
    this.bgAudioManager.playbackRate = 2;
    const duration = this.bgAudioManager.duration;
    this.setData({ duration, playbackRate: 2 });
  },

  onPlay() {
    // 清除章节同步标志，允许 onTimeUpdate 更新进度
    this._syncingChapter = false;
    this.setData({ isPlaying: true });
    this.startCoverRotation();
  },
  onPause() {
    this.setData({ isPlaying: false });
    this.stopCoverRotation();
  },
  onEnded() {
    if (this._audioEndedProcessing) return;
    this._audioEndedProcessing = true;
    this.playNext();
  },

  // 背景图加载回调
  onBgCoverLoad() {
    this.setData({ bgCoverLoaded: true });
  },

  onBgPortraitLoad() {
    this.setData({ bgPortraitLoaded: true });
  },

  // 背景图加载失败时设置标志，使用默认封面
  onBgCoverError() {
    const defaultCover = app.globalData.defaultCoverLocalPath || app.globalData.defaultCoverUrl || '';
    // 如果已经是默认封面，说明默认封面也加载失败，不再重试，清空封面显示默认渐变
    if (this.data.courseCover === defaultCover && defaultCover) {
      this.setData({ bgCoverError: true, courseCover: '', bgCover: '' });
      return;
    }
    // 首次失败，尝试使用默认封面
    this.setData({
      bgCoverError: true,
      courseCover: defaultCover || this.data.courseCover,
      bgCover: defaultCover || this.data.bgCover
    });
  },

  // 封面图加载失败时设置标志，使用默认封面
  onCoverError() {
    const defaultCover = app.globalData.defaultCoverLocalPath || app.globalData.defaultCoverUrl || '';
    // 如果已经是默认封面，说明默认封面也加载失败，不再重试，清空封面显示默认渐变
    if (this.data.courseCover === defaultCover && defaultCover) {
      this.setData({ coverError: true, courseCover: '' });
      return;
    }
    // 首次失败，尝试使用默认封面
    this.setData({
      coverError: true,
      courseCover: defaultCover || this.data.courseCover
    });
  },

  // 点击封面图切换默认封面
  onCoverTap() {
    const { usingDefaultCover, originalCover, courseCover } = this.data;
    const defaultCover = app.globalData.defaultCoverLocalPath || app.globalData.defaultCoverUrl || '';
    if (!defaultCover) return;

    // 如果当前没有原始封面（即originalCover为空），不切换
    if (!originalCover) return;

    if (usingDefaultCover) {
      // 切换回原始封面
      const newCover = this.processImageUrl(originalCover, this.data.coverLoadTime);
      const newBgCover = this.generateBgCoverUrl(originalCover, this.data.coverLoadTime);
      this.setData({
        usingDefaultCover: false,
        courseCover: newCover,
        bgCover: newBgCover,
        coverError: false,
        bgCoverError: false
      });
    } else {
      // 切换到默认封面
      const newBgCover = this.generateBgCoverUrl(defaultCover, this.data.coverLoadTime);
      this.setData({
        usingDefaultCover: true,
        courseCover: defaultCover,
        bgCover: newBgCover,
        coverError: false,
        bgCoverError: false
      });
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
    if (this._playPauseLock) return;
    this._playPauseLock = true;
    setTimeout(() => { this._playPauseLock = false; }, 300);
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
    const { chapters, playMode, sortOrder, currentChapter } = this.data;
    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }

    const currentSeq = currentChapter?.seq;
    if (!currentSeq) return;

    // 根据排序方向计算上一条的 seq
    const targetSeq = sortOrder === 'asc' ? currentSeq - 1 : currentSeq + 1;
    const prevChapter = chapters.find(ch => ch.seq === targetSeq);

    if (prevChapter) {
      const index = chapters.indexOf(prevChapter);
      this.playChapter(index);
    } else if (playMode === 'loop') {
      // 循环模式：回到最后/第一条
      const lastOrFirst = sortOrder === 'asc' ? chapters[chapters.length - 1] : chapters[0];
      const index = chapters.indexOf(lastOrFirst);
      this.playChapter(index);
    } else {
      wx.showToast({ title: '已经是第一条', icon: 'none' });
    }
  },

  playNext() {
    if (this._audioEndedProcessing) return;
    this._audioEndedProcessing = true;

    const { chapters, playMode, sortOrder, currentChapter } = this.data;
    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      this._audioEndedProcessing = false;
      return;
    }

    const currentSeq = currentChapter?.seq;
    if (!currentSeq) {
      this._audioEndedProcessing = false;
      return;
    }

    // 根据排序方向计算下一条的 seq
    const targetSeq = sortOrder === 'asc' ? currentSeq + 1 : currentSeq - 1;
    const nextChapter = chapters.find(ch => ch.seq === targetSeq);

    if (nextChapter) {
      const index = chapters.indexOf(nextChapter);
      this.playChapter(index);
    } else if (playMode === 'loop') {
      // 循环模式：回到第一/最后一条
      const firstOrLast = sortOrder === 'asc' ? chapters[0] : chapters[chapters.length - 1];
      const index = chapters.indexOf(firstOrLast);
      this.playChapter(index);
    } else {
      wx.showToast({ title: '已经是最后一条', icon: 'none' });
    }
    this._audioEndedProcessing = false;
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

    // 计算新章节的播放进度
    const lastPlayTime = Number(chapter.lastPlayTime) || 0;
    const chapterDuration = Number(chapter.duration) || 0;
    const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

    // 标记正在同步章节，阻止 onTimeUpdate 更新进度
    this._syncingChapter = true;

    this.setData({
      currentChapter: chapter,
      currentIndex: index,
      currentTime: lastPlayTime,
      duration: chapterDuration,
      progressPercent: progressPercent
    });
    app.globalData.playingChapter = chapter;
    app.globalData.playingSeq = chapter.seq;
    app.globalData.playingIndex = index;
    app.notifyCallbacks('onChapterChange', { chapterId: chapter._id });
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
        courseId: this.data.currentChapter.course || this.data.course._id,
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
    const playlistPanel = this.selectComponent('#playerPlaylistPanel');
    if (playlistPanel) playlistPanel.show();
  },

  onPlaylistPlay(e) {
    const { chapterId, index } = e.detail;
    const chapter = this.data.chapters.find(ch => ch._id === chapterId);

    if (chapterId === this.data.currentChapter._id) {
      if (this.data.isPlaying) {
        this.bgAudioManager.pause();
        this.saveProgress();
      } else {
        this.bgAudioManager.play();
      }
      return;
    }

    if (chapter?.audioUrl) {
      this.saveProgress();

      // 计算新章节的播放进度
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const chapterDuration = Number(chapter.duration) || 0;
      const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

      // 标记正在同步章节，阻止 onTimeUpdate 更新进度
      this._syncingChapter = true;

      this.setData({
        currentChapter: chapter,
        currentIndex: index,
        currentTime: lastPlayTime,
        duration: chapterDuration,
        progressPercent: progressPercent
      });
      app.globalData.playingChapter = chapter;
      app.globalData.playingSeq = chapter.seq;
      app.globalData.playingIndex = index;
      this.loadAudio(chapter);
      this.checkFavoriteStatus();
      this.updateNextChapterInfo();
    }
  },

  onPlaylistDelete(e) {
    const { chapterId } = e.detail;
    const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
    this.setData({ chapters });
    app.globalData.playlistChaptersData = chapters;

    if (chapterId === this.data.currentChapter._id) {
      this.saveProgress();
      const nextIndex = this.data.currentIndex;
      if (nextIndex < chapters.length && chapters[nextIndex]?.audioUrl) {
        const nextChapter = chapters[nextIndex];

        // 计算新章节的播放进度
        const lastPlayTime = Number(nextChapter.lastPlayTime) || 0;
        const chapterDuration = Number(nextChapter.duration) || 0;
        const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

        // 标记正在同步章节，阻止 onTimeUpdate 更新进度
        this._syncingChapter = true;

        app.globalData.playingChapter = nextChapter;
        app.globalData.playingSeq = nextChapter.seq;
        app.globalData.playingIndex = nextIndex;
        this.setData({
          currentChapter: nextChapter,
          currentIndex: nextIndex,
          currentTime: lastPlayTime,
          duration: chapterDuration,
          progressPercent: progressPercent
        });
        this.loadAudio(nextChapter);
      } else {
        this.bgAudioManager.stop();
        this.setData({ isPlaying: false });
      }
    }
    this.updateNextChapterInfo();
  },

  onPlaylistCollapse() {},

  onPlaylistClear() {
    this.saveProgress();
    this.bgAudioManager.stop();
    this.setData({ isPlaying: false, chapters: [], currentChapter: {}, currentIndex: 0 });
    app.globalData.miniPlayerActive = false;
    app.globalData.playingCourse = null;
    app.globalData.playingChapter = null;
    app.globalData.playingSeq = null;
    app.globalData.playingIndex = 0;
    app.globalData.playlistChaptersData = [];
  },

  onPlaylistSyncSort(e) {
    const { chapters, sortOrder } = e.detail;
    const currentId = this.data.currentChapter._id;
    const newIndex = chapters.findIndex(ch => ch._id === currentId);
    this.setData({ chapters, currentIndex: newIndex, sortOrder }, () => {
      this.updateNextChapterInfo();
    });
    app.globalData.playingIndex = newIndex;
    app.globalData.playlistChaptersData = chapters;
    app.globalData.playlistSortOrder = sortOrder;
  },

  onPlaylistModeChange(e) {
    const { playMode } = e.detail;
    this.setData({ playMode });
    app.globalData.playMode = playMode;
  },

  toggleSort() {
    const { sortOrder, chapters, currentChapter } = this.data;
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';

    // 按 seq 重新排序
    const sortedChapters = [...chapters].sort((a, b) => {
      const diff = (a.seq || 0) - (b.seq || 0);
      return newOrder === 'asc' ? diff : -diff;
    });

    // 找到当前章节在新排序中的位置
    const currentId = currentChapter?._id;
    const newIndex = sortedChapters.findIndex(ch => ch._id === currentId);
    const newCurrentChapter = sortedChapters[newIndex];

    app.globalData.playlistSortOrder = newOrder;
    app.globalData.playlistChaptersData = sortedChapters;

    this.setData({
      sortOrder: newOrder,
      chapters: sortedChapters,
      currentIndex: newIndex >= 0 ? newIndex : 0,
      currentChapter: newCurrentChapter || currentChapter
    }, () => {
      this.updateNextChapterInfo();
    });

    wx.showToast({
      title: newOrder === 'asc' ? '正序' : '倒序',
      icon: 'none'
    });
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
    const { chapters, playMode, sortOrder, currentChapter } = this.data;
    if (!chapters || chapters.length === 0) {
      this.setData({ nextChapterSeq: '', nextChapterTitle: '' });
      return;
    }
    // 单曲循环模式：下一条就是当前条
    if (playMode === 'single') {
      this.setData({ nextChapterSeq: currentChapter.seq, nextChapterTitle: currentChapter.title });
      return;
    }

    const currentSeq = currentChapter?.seq;
    if (!currentSeq) return;

    // 根据排序方向计算下一条的 seq
    const targetSeq = sortOrder === 'asc' ? currentSeq + 1 : currentSeq - 1;
    const nextChapter = chapters.find(ch => ch.seq === targetSeq);

    if (nextChapter) {
      this.setData({ nextChapterSeq: nextChapter.seq, nextChapterTitle: nextChapter.title });
    } else if (playMode === 'loop') {
      const firstOrLast = sortOrder === 'asc' ? chapters[0] : chapters[chapters.length - 1];
      this.setData({ nextChapterSeq: firstOrLast.seq, nextChapterTitle: firstOrLast.title });
    } else {
      this.setData({ nextChapterSeq: '', nextChapterTitle: '已经是最后一条' });
    }
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