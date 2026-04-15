const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

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

    // 计算章节学习进度
    const calcChapterProgress = (chapter) => {
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const playCount = Number(chapter.playCount) || 0;
      const duration = Number(chapter.duration) || 0;

      // 播放量>=1，进度为100%
      if (playCount >= 1) return 100;

      // 上次播放为0且播放量为0，进度为0%
      if (lastPlayTime === 0 && playCount === 0) return 0;

      // 上次播放>0且播放量为0，进度=上次播放/时长
      if (lastPlayTime > 0 && duration > 0) {
        const percent = Math.round((lastPlayTime / duration) * 100);
        return Math.min(percent, 100);
      }

      return 0;
    };

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

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getCategories":
      return await getCategories();
    case "getCourses":
      return await getCourses(event);
    default:
      return { success: false, errMsg: "未知的操作类型" };
  }
};