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
    originalCover: '',
    isFavoriteList: false
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
      onChapterChange: ({ chapterId, chapter, index }) => {
        // 优先使用传入的chapter和index，否则在本地chapters中查找
        const chapters = this.data.chapters;
        const foundChapter = chapter || chapters.find(ch => ch._id === chapterId);
        const foundIndex = index >= 0 ? index : chapters.findIndex(ch => ch._id === chapterId);
        if (foundIndex >= 0 && foundChapter) {
          this.setData({
            currentChapter: foundChapter,
            currentIndex: foundIndex,
            courseTitle: foundChapter.courseTitle || this.data.courseTitle,
            courseAuthor: foundChapter.author || this.data.courseAuthor
          }, () => {
            this.updateNextChapterInfo();
          });
        }
      },
      onPlayModeChange: ({ playMode }) => {
        this.setData({ playMode });
        this.updateNextChapterInfo();
      },
      onLastChapterEnded: () => {
        // 顺序播放到最后一条，停止播放并重置状态
        this.setData({ isPlaying: false, currentTime: 0, duration: 0, progressPercent: 0 });
        this.stopCoverRotation();
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
    // 判断是否是收藏列表（第一条章节有 courseTitle 时认为是跨课程收藏列表）
    const firstChapter = chapters[0];
    const isFavList = !!(firstChapter?.courseTitle);
    // 如果是收藏列表跨课程，course 使用第一条章节的课程信息
    const course = playingCourse?.title && !isFavList ? playingCourse : {
      _id: firstChapter?.course || playingCourse?._id || '',
      title: firstChapter?.courseTitle || playingCourse?.title || '',
      cover: firstChapter?.courseCover || playingCourse?.cover || '',
      author: firstChapter?.author || playingCourse?.author || '',
      chapterCount: chapters.length || 0
    };

    this.setData({
      courseCover,
      bgCover,
      originalCover: playingCourse?.cover || '',
      courseTitle: course.title,
      courseAuthor: course.author || '',
      chapterCount: course.chapterCount,
      currentChapter: currentChapter,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      chapters: chapters,
      course: course,
      sortOrder: playlistSortOrder || 'asc',
      playMode: playMode || 'sequence',
      isPlaying: !this.bgAudioManager.paused,
      currentTime: this.bgAudioManager.currentTime || 0,
      duration: this.bgAudioManager.duration || 0,
      playbackRate: this.bgAudioManager.playbackRate || 2,
      coverLoadTime,
      isFavoriteList: isFavList
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
    const { playlistChaptersData, playlistSortOrder, playingChapter, playingCourse } = app.globalData;
    if (playlistChaptersData && playlistChaptersData.length > 0) {
      const currentId = playingChapter?._id || this.data.currentChapter?._id;
      const newIndex = playlistChaptersData.findIndex(ch => ch._id === currentId);
      const newChapter = newIndex >= 0 ? playlistChaptersData[newIndex] : this.data.currentChapter;
      const firstChapter = playlistChaptersData[0];
      // 如果是收藏列表跨课程，course 使用第一条章节的课程信息
      const updatedCourse = playingCourse?.title ? playingCourse : {
        _id: firstChapter.course,
        title: firstChapter.courseTitle || playingCourse?.title || '',
        cover: firstChapter.courseCover || playingCourse?.cover || '',
        author: firstChapter.author || playingCourse?.author || '',
        chapterCount: playlistChaptersData.length
      };
      // 判断是否是收藏列表（playlistChaptersData 第一条章节有 courseTitle 时认为是跨课程收藏列表）
      const isFavList = !!(firstChapter.courseTitle);
      this.setData({
        chapters: playlistChaptersData,
        sortOrder: playlistSortOrder || 'asc',
        currentIndex: newIndex >= 0 ? newIndex : this.data.currentIndex,
        currentChapter: newChapter,
        course: updatedCourse,
        isFavoriteList: isFavList
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
// 如果正在同步章节或拖动滑块，跳过更新
    if (this._syncingChapter || this._sliderDragging) return;
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
    // 暂停时保存当前播放进度
    if (this.data.currentChapter._id) {
      this.saveProgress();
    }
    this.setData({ isPlaying: false });
    this.stopCoverRotation();
  },
  onEnded() {
    // 转发给 app.js 处理，确保音频结束逻辑被执行
    app.onAudioEnded();
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

  togglePlayPause() {
    app.togglePlayPause();
  },

  rewind15() {
    this.bgAudioManager.seek(Math.max(0, this.bgAudioManager.currentTime - 15));
  },

  forward30() {
    this.bgAudioManager.seek(Math.min(this.bgAudioManager.duration, this.bgAudioManager.currentTime + 30));
  },

  playPrev() {
    if (this.data.currentChapter._id) {
      this.saveProgress();
    }
    app.playPrev();
  },

  playNext() {
    if (this.data.currentChapter._id) {
      this.saveProgress();
    }
    app.playNext();
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
    app.playChapter(chapter._id, chapters);
    this.checkFavoriteStatus();
    this.updateNextChapterInfo();
  },

  saveProgress() {
    const chapterId = this.data.currentChapter._id;
    if (!chapterId || !this.bgAudioManager.currentTime) return Promise.resolve();
    const lastPlayTime = this.bgAudioManager.currentTime;
    const finished = lastPlayTime >= this.bgAudioManager.duration - 10;
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'updateChapterProgress',
        chapterId,
        courseId: this.data.currentChapter.course || this.data.course._id,
        lastPlayTime,
        finished,
        userId: app.globalData.userId
      }
    }).then(() => {
      app.notifyCallbacks('onProgressUpdate', { chapterId, lastPlayTime, finished });
    }).catch(err => console.error('保存进度失败:', err));
  },

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
    const chapter = this.data.chapters.find(ch => ch._id === chapterId);

    if (chapterId === this.data.currentChapter._id) {
      // 点击当前章节，切换播放/暂停
      app.togglePlayPause();
      return;
    }

    if (chapter?.audioUrl) {
      this.saveProgress();
      app.playChapter(chapter._id, this.data.chapters);
      this.checkFavoriteStatus();
      this.updateNextChapterInfo();
    }
  },

  onPlaylistDelete(e) {
    const { chapterId } = e.detail;
    const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
    // 删除后重新生成 index
    const withIndex = chapters.map((ch, idx) => ({ ...ch, index: idx }));

    const currentId = this.data.currentChapter?._id;
    const currentIdx = this.data.currentIndex;

    this.setData({ chapters: withIndex }, () => {
      this.updateNextChapterInfo();
    });
    app.globalData.playlistChaptersData = withIndex;

    if (chapterId === currentId) {
      this.saveProgress();
      // 删除当前播放章节，播放 currentIndex 位置（删除后后面的章节移到这里）
      const nextIndex = currentIdx;
      if (nextIndex < withIndex.length && withIndex[nextIndex]?.audioUrl) {
        app.playChapter(withIndex[nextIndex]._id, withIndex);
      } else if (withIndex.length > 0) {
        const last = withIndex[withIndex.length - 1];
        app.playChapter(last._id, withIndex);
      } else {
        app.stop();
        this.setData({ isPlaying: false });
      }
    }
  },

  onPlaylistCollapse() {},

  onPlaylistClear() {
    this.saveProgress();
    app.stop();
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

    // 直接反转 chapters，保持拖拽后的顺序，只切换显示方向
    const reversed = [...chapters].reverse().map((ch, idx) => ({ ...ch, index: idx }));

    // 找到当前章节在新排序中的位置
    const currentId = currentChapter?._id;
    const newIndex = reversed.findIndex(ch => ch._id === currentId);
    const newCurrentChapter = reversed[newIndex];

    app.globalData.playlistSortOrder = newOrder;
    app.globalData.playlistChaptersData = reversed;
    app.globalData.playingIndex = newIndex >= 0 ? newIndex : 0;

    this.setData({
      sortOrder: newOrder,
      chapters: reversed,
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
        wx.showToast({ title: res.result.data.isFavorite ? '已收藏' : '已取消收藏', icon: 'none' });
      }
    }).catch(err => {
      console.error('切换收藏失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 更新下一条信息
  updateNextChapterInfo() {
    const { chapters, playMode, currentChapter } = this.data;
    if (!chapters || chapters.length === 0) {
      this.setData({ nextChapterSeq: '', nextChapterTitle: '' });
      return;
    }
    // 单曲循环模式：下一条就是当前条
    if (playMode === 'single') {
      this.setData({ nextChapterSeq: currentChapter.seq, nextChapterTitle: currentChapter.title });
      return;
    }

    // 先计算当前章节在数组中的 index，再用 index 找下一条
    const currentIdx = chapters.findIndex(ch => ch._id === currentChapter?._id);
    const nextIndex = currentIdx + 1;
    if (nextIndex < chapters.length) {
      const nextCh = chapters[nextIndex];
      this.setData({ nextChapterSeq: nextCh.seq, nextChapterTitle: nextCh.title });
    } else if (playMode === 'loop') {
      const firstCh = chapters[0];
      this.setData({ nextChapterSeq: firstCh.seq, nextChapterTitle: firstCh.title });
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