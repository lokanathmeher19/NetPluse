const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const usersFilePath = path.join(__dirname, '../data/users.json');
const resultsFilePath = path.join(__dirname, '../data/results.json');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key_123';

const readJson = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch(e) {
        return [];
    }
};

const writeJson = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const users = readJson(usersFilePath);
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            email,
            name: name || email.split('@')[0],
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeJson(usersFilePath, users);

        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, token, user: { id: newUser.id, email: newUser.email, name: newUser.name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const users = readJson(usersFilePath);
        const user = users.find(u => u.email === email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getHistory = (req, res) => {
    try {
        const userId = req.user.id;
        const results = readJson(resultsFilePath);
        
        // Filter results that belong to this user
        const userHistory = results.filter(r => r.userId === userId);
        
        // Sort by newest first
        userHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, data: userHistory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};
