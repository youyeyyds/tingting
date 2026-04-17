const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// ========== 公共函数 ==========

// 计算章节学习进度
const calcChapterProgress = (chapter) => {
  // 确保 finished 字段存在（旧数据默认 false）
  if (chapter.finished === undefined) {
    chapter.finished = false;
  }

  const lastPlayTime = Number(chapter.lastPlayTime) || 0;
  const finished = chapter.finished === true;
  const duration = Number(chapter.duration) || 0;

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

// 获取openid
const getOpenId = async () => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

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

// 查询课程列表（关联分类、章节数、学习进度）
const getCourses = async (event) => {
  try {
    const { limit = 20, filterDraft = false } = event;

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
    const chaptersRes = await db.collection("chapters").get();

    // 构建分类映射 { _id: name }
    const categoryMap = {};
    categoriesRes.data.forEach(cat => {
      categoryMap[cat._id] = cat.name;
    });

    // 关联分类名称、章节数、学习进度到课程
    const courses = coursesRes.data.map(course => {
      // 获取该课程的章节
      const courseChapters = chaptersRes.data.filter(ch => ch.course === course._id);

      // 章节数
      const chapterCount = courseChapters.length;

      // 计算课程学习进度（章节平均进度）
      let progress = 0;
      if (chapterCount > 0) {
        const totalProgress = courseChapters.reduce((sum, ch) => sum + calcChapterProgress(ch), 0);
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

// 获取头条列表
const getHeadlines = async () => {
  try {
    // 获取头条列表
    const headlinesRes = await db.collection("headlines")
      .orderBy("seq", "asc")
      .limit(10)
      .get();

    // 获取轮播配置
    let speed = 3; // 默认3秒
    try {
      const configRes = await db.collection("config").where({ key: 'banner' }).limit(1).get();
      if (configRes.data.length > 0 && configRes.data[0].value && configRes.data[0].value.speed) {
        speed = configRes.data[0].value.speed;
      }
    } catch (e) {
      console.error('获取轮播配置失败:', e);
    }

    return {
      success: true,
      data: headlinesRes.data,
      speed: speed
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 获取课程详情（包含章节）
const getCourseDetail = async (event) => {
  try {
    const { courseId } = event;

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
      .get();

    // 计算课程进度
    let progress = 0;
    const chapterCount = chaptersRes.data.length;
    if (chapterCount > 0) {
      const totalProgress = chaptersRes.data.reduce((sum, ch) => sum + calcChapterProgress(ch), 0);
      progress = Math.round(totalProgress / chapterCount);
    }

    // 处理章节数据
    const processedChapters = chaptersRes.data.map(chapter => {
      const chapterProgress = calcChapterProgress(chapter);
      return {
        ...chapter,
        progress: chapterProgress,
        progressText: getProgressText(chapterProgress),
        durationText: formatDuration(Number(chapter.duration) || 0),
        lastPlayTime: Number(chapter.lastPlayTime) || 0
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

// 更新章节学习进度
const updateChapterProgress = async (event) => {
  try {
    const { chapterId, lastPlayTime, playCount } = event;

    // 先获取章节当前数据
    const chapterRes = await db.collection("chapters").doc(chapterId).get();
    const chapter = chapterRes.data;

    const duration = Number(chapter.duration) || 0;
    const currentFinished = chapter.finished === true;
    const currentPlayCount = Number(chapter.playCount) || 0;

    const updateData = {
      lastPlayTime: lastPlayTime
    };

    // 判断是否需要自动完播
    // 上次播放 >= 时长 > 0，且完播=false，自动转为true，播放量+1
    if (!currentFinished && duration > 0 && lastPlayTime >= duration) {
      updateData.finished = true;
      updateData.playCount = currentPlayCount + 1;
    }

    // 如果 playCount > 0（手动更新播放量），也更新
    if (playCount > 0) {
      updateData.playCount = playCount;
    }

    await db.collection("chapters").doc(chapterId).update({
      data: updateData
    });

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
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getCategories":
      return await getCategories();
    case "getCourses":
      return await getCourses(event);
    case "getHeadlines":
      return await getHeadlines();
    case "getCourseDetail":
      return await getCourseDetail(event);
    case "updateChapterProgress":
      return await updateChapterProgress(event);
    default:
      return { success: false, errMsg: "未知的操作类型" };
  }
};