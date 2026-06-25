const router = require('express').Router();
const { queryAll, queryOne, runQuery } = require('../db/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sanitizeHTML } = require('../middleware/sanitize');

// GET / — list posts with author info, like counts, optional filtering/sorting
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, sort = 'recent' } = req.query;
    const conditions = [];
    const params = [];

    if (category && category !== 'all') {
      conditions.push('p.category = ?');
      params.push(category);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderClause = sort === 'popular' ? 'ORDER BY like_count DESC' : 'ORDER BY p.created_at DESC';

    const sql = `
      SELECT
        p.*,
        u.name AS author_name,
        u.email AS author_email,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      ${orderClause}
    `;

    const posts = await queryAll(sql, params);

    if (req.user) {
      const userLikes = await queryAll('SELECT post_id FROM post_likes WHERE user_id = ?', [req.user.id]);
      const likedSet = new Set(userLikes.map(l => l.post_id));
      posts.forEach(post => {
        post.is_liked = likedSet.has(post.id);
      });
    }

    res.json({ success: true, data: posts });
  } catch (err) {
    console.error('List posts error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch posts' });
  }
});

// POST / — create post
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, body, category, tags } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Title and body are required' });
    }

    const tagsValue = Array.isArray(tags) ? JSON.stringify(tags) : (tags || null);

    const result = await runQuery(
      'INSERT INTO posts (title, body, category, tags, user_id) VALUES (?, ?, ?, ?, ?)',
      [sanitizeHTML(title), sanitizeHTML(body), category || null, tagsValue, req.user.id]
    );

    const post = await queryOne('SELECT * FROM posts WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

// POST /:id/like — toggle like
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await queryOne('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const existingLike = await queryOne(
      'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
      [postId, req.user.id]
    );

    let is_liked;
    if (existingLike) {
      await runQuery('DELETE FROM post_likes WHERE id = ?', [existingLike.id]);
      is_liked = false;
    } else {
      await runQuery('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, req.user.id]);
      is_liked = true;
    }

    const countRow = await queryOne('SELECT COUNT(*) AS like_count FROM post_likes WHERE post_id = ?', [postId]);
    res.json({ success: true, data: { like_count: countRow.like_count, is_liked } });
  } catch (err) {
    console.error('Toggle like error:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
});

// GET /:id/comments — list comments
router.get('/:id/comments', async (req, res) => {
  try {
    const postId = req.params.id;
    const sql = `
      SELECT c.*, u.name AS author_name 
      FROM post_comments c 
      LEFT JOIN users u ON c.user_id = u.id 
      WHERE c.post_id = ? 
      ORDER BY c.created_at ASC
    `;
    const comments = await queryAll(sql, [postId]);
    res.json({ success: true, data: comments });
  } catch (err) {
    console.error('List comments error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

// POST /:id/comments — add a comment
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const { body } = req.body;
    
    if (!body || body.trim() === '') {
      return res.status(400).json({ success: false, error: 'El contenido del comentario es requerido' });
    }

    const result = await runQuery(
      'INSERT INTO post_comments (post_id, user_id, body) VALUES (?, ?, ?)',
      [postId, req.user.id, sanitizeHTML(body)]
    );

    const comment = await queryOne(
      `SELECT c.*, u.name AS author_name 
       FROM post_comments c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.id = ?`,
      [result.lastInsertRowid]
    );

    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

module.exports = router;
