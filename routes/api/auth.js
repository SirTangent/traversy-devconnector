const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const { check, validationResult } = require('express-validator/check/index');

const User = require('../../models/User');

// @route   GET api/auth
// @desc    Gets user information
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(400).json( {errors: [{msg: 'User was deleted'}] });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/auth
// @desc    Authenticate user & get token
// @access  Public
router.post('/', [
    check('email', 'Please include a valid email')
        .isEmail(),
    check('password', 'Please enter password').exists()

], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // See if user exists
        let user = await User.findOne({ email });

        if(!user) {
            return res.status(400).json( {errors: [{msg: 'User does not exist'}] });
        }

        // Validate password for matches
        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch) {
            // Yes, this is a security vulnerability
            return res.status(400).json( {errors: [{msg: 'Password does not match'}] });
        }

        // Return jsonwebtoken
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || config.get('jwtSecret'),
            { expiresIn: process.env.JWT_TIMEOUT || config.get('jwtTokenTimeout') },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            });

    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server error')
    }
});

module.exports = router;
