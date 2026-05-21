const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// ========== 公共函数 ==========

// 从请求中获取用户ID
const getUserId = (event) => {
  return event.userId;
};

// 计算章节学习进度（基于用户进度数据）
const calcChapterProgress = (userProgress, chapterDuration) => {
  // 如果没有用户进度记录，返回0
  if (!userProgress) return 0;

  const finished = userProgress.finished === true;
  const lastPlayTime = Number(userProgress.lastPlayTime) || 0;
  const duration = Number(chapterDuration) || 0;

  // 完播=true，进度为100%
  if (finished) return 100;

  // 上次播放为0，进度为0%
  if (lastPlayTime === 0) return 0;

  // 上次播放>0且时长>0，进度=上次播放/时长
  if (lastPlayTime > 0 && duration > 0) {
    const percent = Math.round((lastPlayTime / duration) * 100);
    return Math.min(percent, 100);
  }

  return 0;
};

// 格式化时长
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 获取进度文本
const getProgressText = (progress) => {
  if (progress === 100) return '已学完';
  if (progress === 0) return '未学习';
  return '已学' + progress + '%';
};

// ========== 云函数功能 ==========

// 获取分类列表
const getCategories = async () => {
  try {
    const res = await db.collection("categories")
      .orderBy("seq", "asc")
      .get();
    return {
      success: true,
      data: res.data
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取版本列表
const getVersions = async () => {
  try {
    console.log('[getVersions] trying to fetch versions collection');
    const res = await db.collection("versions")
      .orderBy("seq", "desc")
      .get();
    console.log('[getVersions] result:', JSON.stringify(res));
    return {
      success: true,
      data: res.data
    };
  } catch (e) {
    console.error('[getVersions] error:', e.message || e);
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 查询课程列表（关联分类、章节数、用户学习进度）
const getCourses = async (event) => {
  try {
    const { limit = 20, filterDraft = false, userId } = event;
    const currentUserId = getUserId(event);

    // 构建查询条件
    let query = db.collection("courses")
      .orderBy("seq", "asc")
      .limit(limit);

    // 小程序端过滤草稿状态
    if (filterDraft) {
      query = query.where({
        status: 'published'
      });
    }

    // 获取课程列表
    const coursesRes = await query.get();

    // 获取分类列表
    const categoriesRes = await db.collection("categories").get();

    // 获取章节列表
    const chaptersRes = await db.collection("chapters").limit(1000).get();

    // 获取用户所有进度记录
    const userProgressRes = await db.collection("userProgress")
      .where({ userId: currentUserId })
      .get();

    // 构建分类映射 { _id: name }
    const categoryMap = {};
    categoriesRes.data.forEach(cat => {
      categoryMap[cat._id] = cat.name;
    });

    // 构建用户进度映射 { chapterId: progressData }
    const userProgressMap = {};
    userProgressRes.data.forEach(progress => {
      userProgressMap[progress.chapterId] = progress;
    });

    // 关联分类名称、章节数、用户学习进度到课程
    const courses = coursesRes.data.map(course => {
      // 获取该课程的章节
      const courseChapters = chaptersRes.data.filter(ch => ch.course === course._id);

      // 章节数
      const chapterCount = courseChapters.length;

      // 计算课程学习进度（章节平均进度，基于用户进度）
      let progress = 0;
      if (chapterCount > 0) {
        const totalProgress = courseChapters.reduce((sum, ch) => {
          const userProgress = userProgressMap[ch._id];
          return sum + calcChapterProgress(userProgress, ch.duration);
        }, 0);
        progress = Math.round(totalProgress / chapterCount);
      }

      return {
        ...course,
        categoryName: categoryMap[course.category] || course.category,
        chapterCount: chapterCount,
        progress: progress
      };
    });

    return {
      success: true,
      data: courses
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取最小课程信息（仅返回基本字段，用于未登录状态）
const getMinimalCourses = async (event) => {
  try {
    const { limit = 20 } = event;

    // 只查询已发布状态的课程，按 seq 排序，只返回基本字段
    const coursesRes = await db.collection("courses")
      .where({ status: 'published' })
      .orderBy("seq", "asc")
      .field({ _id: true, cover: true })
      .limit(limit)
      .get();

    // 获取章节数
    const chaptersRes = await db.collection("chapters").limit(1000).get();

    // 关联章节数到课程
    const courses = coursesRes.data.map(course => {
      const courseChapters = chaptersRes.data.filter(ch => ch.course === course._id);
      return {
        _id: course._id,
        cover: course.cover,
        chapterCount: courseChapters.length
      };
    });

    return {
      success: true,
      data: courses
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取头条列表
const getHeadlines = async (event = {}) => {
  try {
    const page = event.page || 'index'; // page: 'index', 'favorite', 'login', 'mine'
    console.log('getHeadlines 调用参数:', event, 'page:', page);

    // 获取头条列表
    const headlinesRes = await db.collection("headlines")
      .orderBy("seq", "asc")
      .limit(10)
      .get();

    console.log('头条原始数据:', headlinesRes.data.length, '条');

    // 根据页面位置过滤头条
    let filteredHeadlines = headlinesRes.data.filter(h => {
      const positions = h.positions || ['index', 'favorite', 'login', 'mine'];
      const included = positions.includes(page);
      console.log('头条:', h.title, 'positions:', positions, '是否包含', page, ':', included);
      return included;
    });

    console.log('过滤后头条:', filteredHeadlines.length, '条');

    // 获取轮播配置
    let speed = 3; // 默认3秒
    try {
      const configRes = await db.collection("config").where({ key: 'banner' }).limit(1).get();
      if (configRes.data.length > 0 && configRes.data[0].value) {
        speed = configRes.data[0].value.speed || 3;
      }
    } catch (e) {
      console.error('获取轮播配置失败:', e);
    }

    return {
      success: true,
      data: filteredHeadlines,
      speed: speed
    };
  } catch (e) {
    console.error('getHeadlines 错误:', e);
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取课程详情（包含章节和用户进度）
const getCourseDetail = async (event) => {
  try {
    const { courseId, userId } = event;
    const currentUserId = getUserId(event);

    // 获取课程信息
    const courseRes = await db.collection("courses").doc(courseId).get();
    if (!courseRes.data) {
      return {
        success: false,
        errMsg: '课程不存在'
      };
    }
    const course = courseRes.data;

    // 获取分类名称
    let categoryName = course.category;
    try {
      const catRes = await db.collection("categories").doc(course.category).get();
      if (catRes.data) {
        categoryName = catRes.data.name;
      }
    } catch (e) {}

    // 获取章节列表
    const chaptersRes = await db.collection("chapters")
      .where({ course: courseId })
      .orderBy("seq", "asc")
      .limit(1000)
      .get();

    // 获取用户对该课程所有章节的进度 - 只用 userId 查询，不依赖 courseId
    const userProgressRes = await db.collection("userProgress")
      .where({
        userId: currentUserId
      })
      .get();

    // 构建用户进度映射 { chapterId: progressData }
    const userProgressMap = {};
    userProgressRes.data.forEach(progress => {
      userProgressMap[progress.chapterId] = progress;
    });

    // 计算课程进度
    let progress = 0;
    const chapterCount = chaptersRes.data.length;
    if (chapterCount > 0) {
      const totalProgress = chaptersRes.data.reduce((sum, ch) => {
        const userProgress = userProgressMap[ch._id];
        return sum + calcChapterProgress(userProgress, ch.duration);
      }, 0);
      progress = Math.round(totalProgress / chapterCount);
    }

    // 处理章节数据，合并用户进度
    const processedChapters = chaptersRes.data.map(chapter => {
      const userProgress = userProgressMap[chapter._id] || null;
      const chapterProgress = calcChapterProgress(userProgress, chapter.duration);
      return {
        ...chapter,
        // 用户进度字段
        lastPlayTime: userProgress?.lastPlayTime || 0,
        finished: userProgress?.finished || false,
        playCount: userProgress?.playCount || 0,
        isFavorite: userProgress?.isFavorite || false,
        // 计算字段
        progress: chapterProgress,
        progressText: getProgressText(chapterProgress),
        durationText: formatDuration(Number(chapter.duration) || 0)
      };
    });

    return {
      success: true,
      course: {
        ...course,
        categoryName: categoryName,
        chapterCount: chapterCount,
        progress: progress,
        progressText: getProgressText(progress)
      },
      chapters: processedChapters
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 更新章节学习进度（用户进度表 + 章节总播放量）
const updateChapterProgress = async (event) => {
  try {
    const { chapterId, courseId, lastPlayTime, finished, userId } = event;
    const currentUserId = getUserId(event);

    console.log('updateChapterProgress 收到参数:', { chapterId, courseId, lastPlayTime, finished, userId, currentUserId });

    // 获取章节信息
    const chapterRes = await db.collection("chapters").doc(chapterId).get();
    const chapter = chapterRes.data;
    const duration = Number(chapter.duration) || 0;

    // 查询用户进度记录
    const progressRes = await db.collection("userProgress")
      .where({
        userId: currentUserId,
        chapterId: chapterId
      })
      .limit(1)
      .get();

    console.log('查询 userProgress:', currentUserId, chapterId, '找到', progressRes.data?.length, '条');

    const existingProgress = progressRes.data[0];
    const currentFinished = existingProgress?.finished || false;
    const currentPlayCount = existingProgress?.playCount || 0;
    const chapterTotalPlayCount = Number(chapter.playCount) || 0;

    const userUpdateData = {
      lastPlayTime: lastPlayTime
    };

    // 播放完成时的处理
    let userPlayCountIncrease = 0;

    // 手动设置完播（finished=true）或自动判断完播（播放时长>=时长）
    if (finished === true || (finished !== false && duration > 0 && lastPlayTime >= duration - 10)) {
      userPlayCountIncrease = 1;
      userUpdateData.playCount = currentPlayCount + userPlayCountIncrease;
      userUpdateData.finished = true;
      userUpdateData.lastPlayTime = 0;  // 完播后重置上次播放时长为0
    } else if (finished === false) {
      // 手动设置为未完播（暂停、停止、切换播放时）
      userUpdateData.finished = false;
    }
    // finished=undefined时：不修改finished，只更新lastPlayTime

    // 更新或创建用户进度记录
    if (existingProgress) {
      // 如果旧记录没有 courseId 或 duration，补充上
      if (!existingProgress.courseId && (courseId || chapter.course)) {
        userUpdateData.courseId = courseId || chapter.course;
      }
      if (!existingProgress.duration && duration > 0) {
        userUpdateData.duration = duration;
      }
      await db.collection("userProgress").doc(existingProgress._id).update({ data: userUpdateData });
    } else {
      await db.collection("userProgress").add({
        data: {
          userId: currentUserId,
          chapterId: chapterId,
          courseId: courseId || chapter.course,
          duration,
          lastPlayTime: lastPlayTime,
          finished: false,
          playCount: 0,
          isFavorite: false
        }
      });
    }

    // 更新章节总播放量
    if (userPlayCountIncrease > 0) {
      await db.collection("chapters").doc(chapterId).update({
        data: { playCount: chapterTotalPlayCount + userPlayCountIncrease }
      });
    }

    return {
      success: true
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 切换收藏状态
const toggleFavorite = async (event) => {
  try {
    const { chapterId, courseId, userId } = event;
    const currentUserId = getUserId(event);

    // 获取章节信息
    const chapterRes = await db.collection("chapters").doc(chapterId).get();
    const chapter = chapterRes.data;
    const chapterFavoriteCount = Number(chapter.favoriteCount) || 0;

    // 查询用户进度记录
    const progressRes = await db.collection("userProgress")
      .where({
        userId: currentUserId,
        chapterId: chapterId
      })
      .limit(1)
      .get();

    const existingProgress = progressRes.data[0];
    const currentIsFavorite = existingProgress?.isFavorite || false;
    const newIsFavorite = !currentIsFavorite;

    // 更新或创建用户进度记录
    if (existingProgress) {
      const updateData = { isFavorite: newIsFavorite };
      // 收藏时记录收藏时间，取消收藏时清除
      if (newIsFavorite) {
        updateData.favoriteTime = Date.now();
      } else {
        updateData.favoriteTime = null;
      }
      // 如果旧记录没有 courseId，补充上
      if (!existingProgress.courseId && (courseId || chapter.course)) {
        updateData.courseId = courseId || chapter.course;
      }
      await db.collection("userProgress").doc(existingProgress._id).update({ data: updateData });
    } else {
      await db.collection("userProgress").add({
        data: {
          userId: currentUserId,
          chapterId: chapterId,
          courseId: courseId || chapter.course,
          duration: Number(chapter.duration) || 0,
          lastPlayTime: 0,
          finished: false,
          playCount: 0,
          isFavorite: newIsFavorite,
          favoriteTime: newIsFavorite ? Date.now() : null
        }
      });
    }

    // 更新章节总收藏量（+1 或 -1）
    const newFavoriteCount = newIsFavorite
      ? chapterFavoriteCount + 1
      : Math.max(0, chapterFavoriteCount - 1);

    await db.collection("chapters").doc(chapterId).update({
      data: { favoriteCount: newFavoriteCount }
    });

    return {
      success: true,
      data: { isFavorite: newIsFavorite }
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 检查收藏状态
const checkFavorite = async (event) => {
  try {
    const { chapterId, userId } = event;
    const currentUserId = getUserId(event);

    const progressRes = await db.collection("userProgress")
      .where({
        userId: currentUserId,
        chapterId: chapterId
      })
      .limit(1)
      .get();

    const isFavorite = progressRes.data[0]?.isFavorite || false;

    return {
      success: true,
      data: { isFavorite }
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取版权信息
const getCopyright = async () => {
  try {
    const configRes = await db.collection("config").where({ key: 'copyright' }).limit(1).get();
    if (configRes.data.length > 0) {
      const value = configRes.data[0].value || {};
      // 兼容 icpNumber 和 icpText 两种字段名
      const icpNumber = value.icpNumber || value.icpText || '';
      return {
        success: true,
        data: {
          copyrightText: value.copyrightText || '',
          icpNumber: icpNumber
        }
      };
    }
    return {
      success: true,
      data: {
        copyrightText: '',
        icpNumber: ''
      }
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取默认封面
const getDefaultCover = async () => {
  try {
    const res = await db.collection("config").where({ key: "defaultCover" }).limit(1).get();
    if (res.data.length > 0 && res.data[0].value && res.data[0].value.fileID) {
      // 获取云存储文件的临时链接
      const tempUrlResult = await cloud.getTempFileURL({
        fileList: [res.data[0].value.fileID]
      });
      const tempUrl = tempUrlResult.fileList?.[0]?.tempFileURL || null;
      return {
        success: true,
        data: {
          coverUrl: tempUrl
        }
      };
    }
    return {
      success: true,
      data: { coverUrl: null }
    };
  } catch (e) {
    // 集合不存在时返回空
    if (e.message && e.message.includes("not exist")) {
      return {
        success: true,
        data: { coverUrl: null }
      };
    }
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取用户课程偏好设置
const getCourseSettings = async (event) => {
  try {
    const { courseId } = event;
    const currentUserId = getUserId(event);

    // 验证参数
    if (!currentUserId) {
      return {
        success: false,
        errMsg: '用户未登录'
      };
    }

    const res = await db.collection("userChapterSettings")
      .where({
        userId: currentUserId,
        courseId: courseId
      })
      .limit(1)
      .get();

    if (res.data.length > 0) {
      const settings = res.data[0];
      return {
        success: true,
        data: {
          sortOrder: settings.sortOrder || 'asc',
          showUnfinishedOnly: settings.showUnfinishedOnly || false,
          lastPlayedChapterId: settings.lastPlayedChapterId || null
        }
      };
    }
    // 如果没有设置，返回默认值
    return {
      success: true,
      data: {
        sortOrder: 'asc',
        showUnfinishedOnly: false,
        lastPlayedChapterId: null
      }
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 更新用户课程偏好设置
const updateCourseSettings = async (event) => {
  try {
    const { courseId, sortOrder, showUnfinishedOnly, lastPlayedChapterId } = event;
    const currentUserId = getUserId(event);

    // 验证参数
    if (!currentUserId) {
      return {
        success: false,
        errMsg: '用户未登录'
      };
    }
    if (!courseId) {
      return {
        success: false,
        errMsg: '课程ID不能为空'
      };
    }

    // 查询是否已存在设置
    const res = await db.collection("userChapterSettings")
      .where({
        userId: currentUserId,
        courseId: courseId
      })
      .limit(1)
      .get();

    const updateData = {
      updateTime: Date.now()
    };
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (showUnfinishedOnly !== undefined) updateData.showUnfinishedOnly = showUnfinishedOnly;
    if (lastPlayedChapterId !== undefined) updateData.lastPlayedChapterId = lastPlayedChapterId;

    if (res.data.length > 0) {
      // 更新已有记录
      await db.collection("userChapterSettings")
        .doc(res.data[0]._id)
        .update({ data: updateData });
    } else {
      // 创建新记录
      const newData = {
        userId: currentUserId,
        courseId: courseId,
        updateTime: Date.now()
      };
      if (sortOrder !== undefined) newData.sortOrder = sortOrder;
      if (showUnfinishedOnly !== undefined) newData.showUnfinishedOnly = showUnfinishedOnly;
      if (lastPlayedChapterId !== undefined) newData.lastPlayedChapterId = lastPlayedChapterId;
      await db.collection("userChapterSettings")
        .add({ data: newData });
    }

    return {
      success: true
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 云函数入口函数

// 获取武功列表（用于首页脱敏）
const getMartialArts = async (event) => {
  try {
    const { limit = 50 } = event;
    console.log('[getMartialArts] limit:', limit);
    // 获取武功列表，随机排序
    const martialArtsRes = await db.collection("martialArts")
      .aggregate()
      .sample({ size: parseInt(limit) })
      .end();

    const martialArts = martialArtsRes.list || [];
    console.log('[getMartialArts] martialArts count:', martialArts.length);

    if (martialArts.length === 0) {
      return { success: true, data: [] };
    }

    // 获取所有关联的类型、门派、小说
    const typeIds = martialArts.map(m => m.typeId).filter(Boolean);
    const factionIds = martialArts.map(m => m.factionId).filter(Boolean);
    const novelIds = martialArts.map(m => m.novelId).filter(Boolean);

    const [typesRes, factionsRes, novelsRes, relationsRes] = await Promise.all([
      typeIds.length > 0 ? db.collection("martialArtTypes").where({ _id: db.command.in(typeIds) }).get() : { data: [] },
      factionIds.length > 0 ? db.collection("martialArtFactions").where({ _id: db.command.in(factionIds) }).get() : { data: [] },
      novelIds.length > 0 ? db.collection("martialArtNovels").where({ _id: db.command.in(novelIds) }).get() : { data: [] },
      db.collection("martialArtCharacterRelations").where({ martialArtId: db.command.in(martialArts.map(m => m._id)) }).get()
    ]);

    // 构建映射
    const typeMap = {};
    typesRes.data.forEach(t => { typeMap[t._id] = t.name; });
    const factionMap = {};
    factionsRes.data.forEach(f => { factionMap[f._id] = f.name; });
    const novelMap = {};
    novelsRes.data.forEach(n => { novelMap[n._id] = n.name; });

    // 获取人物详情
    const characterIds = relationsRes.data.map(r => r.characterId).filter(Boolean);
    const charactersDetailRes = characterIds.length > 0
      ? await db.collection("martialArtCharacters").where({ _id: db.command.in(characterIds) }).get()
      : { data: [] };
    const characterMap = {};
    charactersDetailRes.data.forEach(c => { characterMap[c._id] = c.name; });

    // 关联人物
    const characterRelationMap = {};
    relationsRes.data.forEach(rel => {
      if (!characterRelationMap[rel.martialArtId]) {
        characterRelationMap[rel.martialArtId] = [];
      }
      if (characterMap[rel.characterId]) {
        characterRelationMap[rel.martialArtId].push(characterMap[rel.characterId]);
      }
    });

    // 组装数据
    const data = martialArts.map(m => ({
      _id: m._id,
      name: m.name,
      description: m.description || '',
      type: typeMap[m.typeId] || '',
      faction: factionMap[m.factionId] || '',
      novel: novelMap[m.novelId] || '',
      users: characterRelationMap[m._id] || []
    }));

    console.log('[getMartialArts] returning data count:', data.length);
    return {
      success: true,
      data
    };
  } catch (e) {
    console.error('[getMartialArts] error:', e);
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      const wxContext = cloud.getWXContext();
      return {
        openid: wxContext.OPENID,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID
      };
    case "getCategories":
      return await getCategories();
    case "getVersions":
      return await getVersions();
    case "getCourses":
      return await getCourses(event);
    case "getHeadlines":
      return await getHeadlines(event);
    case "getCourseDetail":
      return await getCourseDetail(event);
    case "updateChapterProgress":
      return await updateChapterProgress(event);
    case "toggleFavorite":
      return await toggleFavorite(event);
    case "checkFavorite":
      return await checkFavorite(event);
    case "getCopyright":
      return await getCopyright();
    case "getDefaultCover":
      return await getDefaultCover();
    case "getCourseSettings":
      return await getCourseSettings(event);
    case "updateCourseSettings":
      return await updateCourseSettings(event);
    case "getMartialArts":
      return await getMartialArts(event);
    case "getMinimalCourses":
      return await getMinimalCourses(event);
    default:
      return { success: false, errMsg: "未知的操作类型" };
  }
};