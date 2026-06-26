// Mock database for emails
const notifyList = new Set();

exports.notify = (req, res) => {
    const { email, feature } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    // In a real app we'd save this to a DB (Postgres, MongoDB)
    notifyList.add(email);
    console.log(`[Notification Request] Added ${email} for feature: ${feature}`);

    res.json({ success: true, message: 'You will be notified when this feature is ready!' });
};
