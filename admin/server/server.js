/**
 * 听听课程管理后台服务
 * 处理前端请求并与微信云开发交互
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const musicMetadata = require('music-metadata');
const cloudbase = require('@cloudbase/node-sdk');
const tencentcloud = require('tencentcloud-sdk-nodejs');
const bcrypt = require('bcryptjs');
const CamClient = tencentcloud.cam.v20190116.Client;

// ========== 配置 ==========

const ENV_ID = 'cloud1-2g5y53suf638dfb9';
const CLOUD_PATH_PREFIX = 'audio/';

// ========== 初始化 ==========

const app = express();

// 配置 multer 正确处理中文文件名
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + originalName);
  }
});

const upload = multer({ storage: storage });

// 中间件
app.use(express.json());

// 从请求头获取凭证并初始化云开发
function getTcbFromRequest(req) {
  const secretId = req.headers['x-secret-id'];
  const secretKey = req.headers['x-secret-key'];
  const envId = req.headers['x-env-id'] || ENV_ID;

  if (!secretId || !secretKey) {
    return null;
  }

  return cloudbase.init({
    env: envId,
    secretId: secretId,
    secretKey: secretKey
  });
}

// 响应封装
function success(data) {
  return { success: true, data };
}

function error(msg) {
  return { success: false, error: msg };
}

// ========== 认证 API ==========

// 测试连接
app.post('/api/auth/test', async (req, res) => {
  try {
    const { secretId, secretKey, envId } = req.body;

    const tcb = cloudbase.init({
      env: envId || ENV_ID,
      secretId: secretId,
      secretKey: secretKey
    });

    const db = tcb.database();

    // 测试查询 users 集合总数
    const countResult = await db.collection('users').count();

    res.json(success({ connected: true, count: countResult.total }));
  } catch (err) {
    res.json(error(err.message || '连接失败'));
  }
});

// 手机号登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone) {
      return res.json(error('请输入手机号'));
    }

    if (!password) {
      return res.json(error('请输入密码'));
    }

    // 使用系统配置的凭证
    const secretId = req.headers['x-secret-id'];
    const secretKey = req.headers['x-secret-key'];
    const envId = req.headers['x-env-id'] || ENV_ID;

    if (!secretId || !secretKey) {
      return res.json(error('系统未配置凭证，请先在系统配置中设置'));
    }

    const tcb = cloudbase.init({
      env: envId,
      secretId: secretId,
      secretKey: secretKey
    });

    const db = tcb.database();

    // 查询用户
    const userResult = await db.collection('users').where({ phone }).limit(1).get();

    if (userResult.data.length === 0) {
      return res.json(error('手机号未注册'));
    }

    const user = userResult.data[0];

    // 验证密码（哈希比对）
    if (!user.password) {
      return res.json(error('用户未设置密码'));
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.json(error('密码错误'));
    }

    // 更新最后登录时间
    await db.collection('users').doc(user._id).update({
      lastLoginTime: new Date()
    });

    // 获取角色信息
    let roleName = '';
    let roleCode = '';
    let permissions = [];
    if (user.role) {
      const roleResult = await db.collection('roles').doc(user.role).get();
      if (roleResult.data.length > 0) {
        roleName = roleResult.data[0].name;
        roleCode = roleResult.data[0].code;
        permissions = roleResult.data[0].permissions || [];
      }
    }

    // 处理头像URL - 返回原始fileID，让前端动态获取临时链接
    let avatarUrl = user.avatarUrl || '';

    res.json(success({
      userId: user._id,
      phone: user.phone,
      nickName: user.nickName,
      avatarUrl: avatarUrl,
      roleName: roleName,
      roleCode: roleCode,
      permissions: permissions
    }));
  } catch (err) {
    res.json(error(err.message || '登录失败'));
  }
});

// 获取账号信息
app.get('/api/auth/account', async (req, res) => {
  try {
    const secretId = req.headers['x-secret-id'];
    const secretKey = req.headers['x-secret-key'];

    if (!secretId || !secretKey) {
      return res.json(error('未登录'));
    }

    // 创建CAM客户端
    const client = new CamClient({
      credential: {
        secretId: secretId,
        secretKey: secretKey
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'cam.tencentcloudapi.com'
        }
      }
    });

    // 获取用户AppId信息
    const appidResult = await client.GetUserAppId({});
    const ownerUin = String(appidResult.OwnerUin);  // 主账号ID
    const appId = appidResult.AppId;
    const apiUin = String(appidResult.Uin || ownerUin);

    let userName = '';
    let userType = '主账号';
    let currentUin = ownerUin;

    // 尝试GetAccountSummary获取账号概览（主账号名称）
    try {
      const summaryResult = await client.GetAccountSummary({});
      if (summaryResult.Uin === ownerUin) {
        // 主账号可能有别名
      }
    } catch (e) {
      // 忽略
    }

    // 尝试ListUsers获取子用户列表
    try {
      const listUsersResult = await client.ListUsers({});
      if (listUsersResult.Data && Array.isArray(listUsersResult.Data)) {
        // 检查当前API调用者是否在子用户列表中
        const matchingUser = listUsersResult.Data.find(u => String(u.Uin) === apiUin);
        if (matchingUser) {
          userName = matchingUser.Name || '';
          currentUin = String(matchingUser.Uin);
          userType = '子用户';
        }
      }
    } catch (e) {
      // 忽略
    }

    // 如果是主账号且没有获取到名字，尝试DescribeSubAccounts获取主账号信息
    if (userType === '主账号') {
      currentUin = ownerUin;
      try {
        const subAccountsResult = await client.DescribeSubAccounts({
          SubAccountUin: [parseInt(ownerUin)]
        });
        if (subAccountsResult.Data && subAccountsResult.Data.length > 0) {
          userName = subAccountsResult.Data[0].Name || '';
        }
      } catch (e) {
        // DescribeSubAccounts可能不适用于主账号
      }
    }

    res.json(success({
      userName: userName || '未知用户',
      userType: userType,
      appId: appId,
      ownerUin: ownerUin,
      currentUin: currentUin
    }));
  } catch (err) {
    res.json(error(err.message || '获取账号信息失败'));
  }
});

// ========== 批量更新序号 API ==========

// 批量更新序号
app.post('/api/batch-update-seq', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const { collection, updates } = req.body;

    if (!collection || !updates || !Array.isArray(updates)) {
      return res.json(error('参数错误'));
    }

    // 批量更新
    for (const item of updates) {
      await db.collection(collection).doc(item._id).update({
        seq: item.seq
      });
    }

    res.json(success({ updated: updates.length }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 课程 API ==========

// 获取课程列表
app.get('/api/courses', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();

    // 获取课程列表
    const coursesRes = await db.collection('courses').orderBy('seq', 'asc').get();

    // 获取分类列表
    const categoriesRes = await db.collection('categories').get();

    // 获取所有章节数量统计
    const chaptersRes = await db.collection('chapters').get();
    const chaptersCountMap = {};
    chaptersRes.data.forEach(chapter => {
      chaptersCountMap[chapter.course] = (chaptersCountMap[chapter.course] || 0) + 1;
    });

    // 构建分类映射
    const categoryMap = {};
    categoriesRes.data.forEach(cat => {
      categoryMap[cat._id] = cat.name;
    });

    // 关联分类名称和章节数
    const courses = coursesRes.data.map(course => ({
      ...course,
      categoryName: categoryMap[course.category] || '-',
      chapters: chaptersCountMap[course._id] || 0
    }));

    res.json(success(courses));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建课程
app.post('/api/courses', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('courses').add({
      seq: data.seq || 1,
      title: data.title,
      author: data.author,
      category: data.category,
      cover: data.cover,
      description: data.description,
      status: data.status || 'published'
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新课程
app.put('/api/courses/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('courses').doc(id).update({
      seq: data.seq,
      title: data.title,
      author: data.author,
      category: data.category,
      cover: data.cover,
      description: data.description,
      status: data.status
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除课程
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 删除关联的章节
    await db.collection('chapters').where({ course: id }).remove();

    // 删除课程
    await db.collection('courses').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 章节 API ==========

// 获取章节列表
app.get('/api/chapters', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const courseId = req.query.courseId;

    let query = db.collection('chapters');
    if (courseId) {
      query = query.where({ course: courseId });
    }

    const result = await query.orderBy('seq', 'asc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建章节
app.post('/api/chapters', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('chapters').add({
      course: data.course,
      seq: data.seq || 1,
      title: data.title,
      audio: data.audio || '',
      status: data.status || 'published'
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新章节
app.put('/api/chapters/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('chapters').doc(id).update({
      seq: data.seq,
      title: data.title,
      audio: data.audio,
      status: data.status
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除章节
app.delete('/api/chapters/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 删除章节
    await db.collection('chapters').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 音频 API ==========

// 获取音频列表
app.get('/api/audios', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('audios').orderBy('_createTime', 'desc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 上传音频
app.post('/api/audios/upload', upload.single('audio'), async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const file = req.file;
    const { courseId, seq, title } = req.body;

    if (!file) return res.json(error('请选择音频文件'));
    if (!courseId) return res.json(error('请选择课程'));

    // 获取音频元数据
    const metadata = await musicMetadata.parseFile(file.path);
    const duration = Math.round(metadata.format.duration || 0);
    const fileSize = file.size;

    // 原始文件名（修复编码）
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const cloudPath = `${CLOUD_PATH_PREFIX}${originalName}`;

    // 上传到云存储
    const fileContent = fs.readFileSync(file.path);
    const uploadResult = await tcb.uploadFile({
      cloudPath: cloudPath,
      fileContent: fileContent
    });

    // 删除临时文件
    fs.unlinkSync(file.path);

    if (!uploadResult.fileID) {
      return res.json(error('云存储上传失败'));
    }

    // 写入 audios 集合
    const audioResult = await db.collection('audios').add({
      title: title || originalName.replace(/\.(mp3|m4a|wav)$/, ''),
      audioFile: uploadResult.fileID,
      duration: duration,
      fileSize: fileSize
    });

    // 写入 chapters 集合
    const chapterSeq = seq ? parseInt(seq) : 0;
    const chapterTitle = title || originalName.replace(/^(\d+)\.\s*/, '').replace(/\.(mp3|m4a|wav)$/, '');

    await db.collection('chapters').add({
      course: courseId,
      seq: chapterSeq,
      title: chapterTitle,
      audio: audioResult.id,
      status: 'published'
    });

    res.json(success({
      audioId: audioResult.id,
      fileID: uploadResult.fileID,
      duration: duration,
      fileSize: fileSize
    }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除音频
app.delete('/api/audios/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 获取音频信息
    const audio = await db.collection('audios').doc(id).get();
    const audioData = audio.data[0];

    if (audioData && audioData.audioFile) {
      // 删除云存储文件
      await tcb.deleteFile({ fileList: [audioData.audioFile] });
    }

    // 删除 audios 记录
    await db.collection('audios').doc(id).remove();

    // 删除关联的章节（如果有）
    const chapters = await db.collection('chapters').where({ audio: id }).get();
    if (chapters.data.length > 0) {
      for (const chapter of chapters.data) {
        await db.collection('chapters').doc(chapter._id).remove();
      }
    }

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 分类 API ==========

// 获取分类列表
app.get('/api/categories', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('categories').orderBy('seq', 'asc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建分类
app.post('/api/categories', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('categories').add({
      seq: data.seq || 1,
      name: data.name,
      description: data.description || ''
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新分类
app.put('/api/categories/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('categories').doc(id).update({
      seq: data.seq,
      name: data.name,
      description: data.description
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除分类
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    await db.collection('categories').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 用户 API ==========

// 上传头像
app.post('/api/users/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const file = req.file;
    if (!file) return res.json(error('请选择图片文件'));

    // 原始文件名（修复编码）
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const cloudPath = `avatars/${Date.now()}_${originalName}`;

    // 上传到云存储
    const fileContent = fs.readFileSync(file.path);
    const uploadResult = await tcb.uploadFile({
      cloudPath: cloudPath,
      fileContent: fileContent
    });

    // 删除临时文件
    fs.unlinkSync(file.path);

    if (!uploadResult.fileID) {
      return res.json(error('云存储上传失败'));
    }

    // 返回 fileID，前端存储 fileID，获取用户时动态获取访问链接
    res.json(success({ fileID: uploadResult.fileID }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 获取用户列表
app.get('/api/users', async (req, res) => {
  try {
    const secretId = req.headers['x-secret-id'];
    const secretKey = req.headers['x-secret-key'];
    const envId = req.headers['x-env-id'] || ENV_ID;
    const currentUserId = req.headers['x-user-id'];
    const currentRoleCode = req.headers['x-role-code'];

    if (!secretId || !secretKey) {
      return res.json(error('未登录'));
    }

    const tcb = cloudbase.init({
      env: envId,
      secretId: secretId,
      secretKey: secretKey
    });

    const db = tcb.database();

    // 根据角色决定查询范围
    let query = db.collection('users');

    // 非管理员只能看到自己
    if (currentRoleCode !== 'admin' && currentUserId) {
      query = query.where({ _id: currentUserId });
    }

    const result = await query.orderBy('seq', 'asc').get();

    const users = result.data;

    // 不再处理临时链接，让前端自己处理
    // 返回原始avatarUrl（cloud://格式），前端会动态获取临时链接

    res.json(success(users));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 获取云存储文件临时链接
app.post('/api/file/temp-url', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const { fileID } = req.body;
    if (!fileID || !fileID.startsWith('cloud://')) {
      return res.json(error('无效的文件ID'));
    }

    const urlResult = await tcb.getTempFileURL({
      fileList: [fileID],
      maxAge: 7 * 24 * 60 * 60  // 7天有效期
    });

    if (urlResult.fileList && urlResult.fileList[0]?.tempFileURL) {
      res.json(success({ tempFileURL: urlResult.fileList[0].tempFileURL }));
    } else {
      res.json(error('获取临时链接失败'));
    }
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建用户
app.post('/api/users', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    // 自动计算序号：获取最大序号 + 1
    const result = await db.collection('users').orderBy('seq', 'desc').limit(1).get();
    const maxSeq = result.data.length > 0 ? result.data[0].seq : 0;
    const newSeq = maxSeq + 1;

    // 昵称为空时自动生成
    let nickName = data.nickName;
    if (!nickName && data.phone) {
      nickName = '用户' + data.phone.slice(-4);
    }

    // 角色为空时自动为普通用户
    let role = data.role;
    if (!role) {
      const rolesRes = await db.collection('roles').where({ code: 'user' }).get();
      if (rolesRes.data.length > 0) {
        role = rolesRes.data[0]._id;
      }
    }

    // 对密码进行哈希处理，默认密码为 '1'
    const plainPassword = data.password || '1';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const userResult = await db.collection('users').add({
      seq: newSeq,
      nickName: nickName,
      avatarUrl: data.avatarUrl || '',
      phone: data.phone,
      password: hashedPassword,
      role: role,
      createTime: new Date()
    });

    res.json(success({ id: userResult.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新用户
app.put('/api/users/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    // 如果更新头像，先删除旧头像
    if (data.avatarUrl) {
      const oldUser = await db.collection('users').doc(id).get();
      const oldAvatarUrl = oldUser.data[0]?.avatarUrl;
      // 如果旧头像存在且是 cloud:// 格式，且与新头像不同
      if (oldAvatarUrl && oldAvatarUrl.startsWith('cloud://') && oldAvatarUrl !== data.avatarUrl) {
        try {
          await tcb.deleteFile({ fileList: [oldAvatarUrl] });
        } catch (e) {
          console.error('删除旧头像失败:', e.message);
        }
      }
    }

    const updateData = {
      seq: data.seq,
      nickName: data.nickName,
      avatarUrl: data.avatarUrl,
      phone: data.phone,
      role: data.role
    };

    // 更新密码（只有传了密码才更新，需要哈希处理）
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // 只有管理员可以修改最后登录时间
    if (data.lastLoginTime) {
      updateData.lastLoginTime = data.lastLoginTime;
    }

    await db.collection('users').doc(id).update(updateData);

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除用户
app.delete('/api/users/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 先获取用户信息，删除头像文件
    const user = await db.collection('users').doc(id).get();
    const avatarUrl = user.data[0]?.avatarUrl;
    if (avatarUrl && avatarUrl.startsWith('cloud://')) {
      try {
        await tcb.deleteFile({ fileList: [avatarUrl] });
      } catch (e) {
        console.error('删除用户头像失败:', e.message);
      }
    }

    // 删除用户
    await db.collection('users').doc(id).remove();

    // 获取剩余用户并重新排列序号
    const remainingUsers = await db.collection('users').orderBy('seq', 'asc').get();
    for (let i = 0; i < remainingUsers.data.length; i++) {
      const u = remainingUsers.data[i];
      if (u.seq !== i + 1) {
        await db.collection('users').doc(u._id).update({
          seq: i + 1
        });
      }
    }

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 角色 API ==========

// 获取角色列表
app.get('/api/roles', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('roles').orderBy('seq', 'asc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建角色
app.post('/api/roles', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('roles').add({
      seq: data.seq || 1,
      name: data.name,
      code: data.code,
      description: data.description || '',
      permissions: data.permissions || []
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新角色
app.put('/api/roles/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('roles').doc(id).update({
      seq: data.seq,
      name: data.name,
      code: data.code,
      description: data.description,
      permissions: data.permissions
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除角色
app.delete('/api/roles/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 检查是否有用户使用此角色
    const usersWithRole = await db.collection('users').where({ role: id }).count();
    if (usersWithRole.total > 0) {
      return res.json(error(`有 ${usersWithRole.total} 个用户使用此角色，无法删除`));
    }

    await db.collection('roles').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 菜单配置 API ==========

// 获取菜单配置
app.get('/api/menu-config', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();

    // 尝试查询，如果集合不存在则返回默认配置
    try {
      const result = await db.collection('config').where({ key: 'menuOrder' }).limit(1).get();
      if (result.data.length > 0) {
        res.json(success({ menuOrder: result.data[0].value }));
      } else {
        const defaultOrder = ['courses', 'chapters', 'audios', 'categories', 'users', 'roles', 'system'];
        res.json(success({ menuOrder: defaultOrder }));
      }
    } catch (e) {
      // 集合不存在，返回默认配置
      if (e.message && e.message.includes('not exist')) {
        const defaultOrder = ['courses', 'chapters', 'audios', 'categories', 'users', 'roles', 'system'];
        res.json(success({ menuOrder: defaultOrder }));
      } else {
        throw e;
      }
    }
  } catch (err) {
    res.json(error(err.message));
  }
});

// 保存菜单配置
app.post('/api/menu-config', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const { menuOrder } = req.body;

    if (!menuOrder || !Array.isArray(menuOrder)) {
      return res.json(error('菜单顺序数据无效'));
    }

    // 尝试查询是否已有配置
    let existing = null;
    try {
      const result = await db.collection('config').where({ key: 'menuOrder' }).limit(1).get();
      existing = result.data.length > 0 ? result.data[0] : null;
    } catch (e) {
      // 集合不存在，尝试创建集合
      if (e.message && e.message.includes('not exist')) {
        console.log('config集合不存在，尝试创建...');
        try {
          await db.createCollection('config');
          console.log('config集合创建成功');
        } catch (createErr) {
          console.log('创建集合失败:', createErr.message);
        }
      }
    }

    if (existing) {
      // 更新现有配置
      await db.collection('config').doc(existing._id).update({
        value: menuOrder,
        updateTime: new Date()
      });
    } else {
      // 创建新配置
      await db.collection('config').add({
        key: 'menuOrder',
        value: menuOrder,
        createTime: new Date()
      });
    }

    res.json(success({ saved: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 启动服务器 ==========

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`后台服务已启动: http://localhost:${PORT}`);
  console.log('请确保前端服务也在运行 (npm run dev)');
});