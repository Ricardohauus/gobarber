import User from '../models/User';
import Notification from '../schemas/Notification';

class NotificationController {
    async index(req, res) {
        const checkUserProvider = await User.findOne({
            where: { id: req.userId, provider: true },
        });

        if (!checkUserProvider) {
            return res
                .status(401)
                .json({ error: 'Usuário não é um prestador de serviço' });
        }

        const notifications = await Notification.find({ user: req.userId })
            .sort({ createdAt: 'desc' })
            .limit(20);
        return res.json(notifications);
    }
}

export default new NotificationController();
