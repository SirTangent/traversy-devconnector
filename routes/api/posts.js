const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator/check');
const auth = require('../../middleware/auth');

// Import models
const Post = require('../../models/Post');
const Profile = require('../../models/Profile');
const User = require('../../models/User');

const ERR_NOTFOUND = 'Post not found or is private';

// @route   POST api/posts
// @desc    Create a post
// @access  Private
router.post('/', [auth, [
    check('text', 'Post text is required')
        .not()
        .isEmpty()
]], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findById(req.user.id).select('-password');

        const newPost = new Post({
            text: req.body.text,
            name: user.name,
            avatar: user.avatar,
            user: req.user.id
        });

        if (typeof req.body.ispublic == 'boolean' && !req.body.ispublic) newPost.ispublic = false;

        await newPost.save();

        res.json(newPost);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/posts
// @desc    Get all public posts
// @access  Private
router.get('/', auth, async (req,res) => {
    try {
        const posts = await Post.find({ ispublic: true }).sort({ date: -1 });
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/posts/:id
// @desc    Get a public post by ID
// @access  Private
router.get('/:id', auth, async (req,res) => {
    try {
        const post = await Post.findById(req.params.id);

        if(!post.ispublic){
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] })
        }

        res.json(post);
    } catch (err) {
        if(err.kind == 'ObjectId') {
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/posts/:id
// @desc    Delete users post by id
// @access  Private
router.delete('/:id', auth, async (req,res) => {
    try {
        const post = await Post.findById(req.params.id);

        // Check post
        if(!post) {
            return res.status(404).json({ errors: [{msg: 'Post not found'}] });
        }

        // Check user
        if(post.user.toString() != req.user.id) {
            return res.status(401).json({ errors: [{msg: 'User unauthorized to delete post'}] });
        }

        await post.remove();

        res.json({ msg: 'Post removed' });
    } catch (err) {
        if(err.kind == 'ObjectId') {
            return res.status(404).json( {errors: [{msg: 'Post not found'}] });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/posts/like/:id
// @desc    Like a post
// @access  Private
router.put('/like/:id', auth, async (req,res) => {
    try {
        const post = await Post.findById(req.params.id);

        // Check if post exists or is public
        if(!post.ispublic){
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] })
        }

        // Check if the post has already been liked
        if(post.likes.filter((like) => like.user.toString() == req.user.id).length > 0) {
            return res.status(400).json({ msg: 'Post already liked' })
        }

        post.likes.unshift({ user: req.user.id });

        await post.save();

        res.json(post.likes);
    } catch (err) {
        if(err.kind == 'ObjectId') {
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/posts/unlike/:id
// @desc    Unlike a post
// @access  Private
router.put('/unlike/:id', auth, async (req,res) => {
    try {
        const post = await Post.findById(req.params.id);

        // Check if post exists or is public
        if(!post.ispublic){
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] })
        }

        // Check if the post has not been liked
        if(post.likes.filter((like) => like.user.toString() == req.user.id).length == 0) {
            return res.status(400).json({ msg: 'Post was never liked' })
        }

        const removeIndex = post.likes.map(like => like.user.toString()).indexOf(req.user.id);
        if(removeIndex >= 0) {
            post.likes.splice(removeIndex, 1);
            await post.save();
        }

        res.json(post.likes);
    } catch (err) {
        if(err.kind == 'ObjectId') {
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/posts/comment/:id
// @desc    Comment on a post
// @access  Private
router.post('/comment/:id', [auth, [
    check('text', 'Comment text is required')
        .not()
        .isEmpty()
]], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findById(req.user.id).select('-password');
        const post = await Post.findById(req.params.id);

        // Check if post exists or is public
        if(!post.ispublic){
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] })
        }

        const newComment = {
            text: req.body.text,
            name: user.name,
            avatar: user.avatar,
            user: req.user.id
        };

        post.comments.unshift(newComment);

        await post.save();

        res.json(post.comments);
    } catch (err) {
        if(err.kind == 'ObjectId') {
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/posts/comment/:id/:comment_id
// @desc    Delete comment
// @access  Private
router.delete('/comment/:id/:comment_id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        // Pull out comment
        const removeIndex = post.comments.findIndex(comment => comment.id == req.params.comment_id);
        const comment = post.comments[removeIndex];

        // Make sure comment exists
        if(!comment) {
            return res.status(404).json({ msg: 'Comment does not exist' })
        }

        // Check user
        if(comment.user.toString() != req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' })
        }

        // Get remove index
        if(removeIndex >= 0) {
            post.comments.splice(removeIndex, 1);
            await post.save();
        }

        res.json({ msg: 'Comment deleted' });

    } catch (err) {
        if(err.kind == 'ObjectId') {
            return res.status(404).json( {errors: [{msg: ERR_NOTFOUND}] });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
