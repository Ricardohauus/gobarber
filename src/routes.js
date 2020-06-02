import { Router } from 'express';
import User from './app/models/User';
const routes = new Router();

routes.get('/', async(req, res) => {
    const user = await User.create({
        name: 'Ricardo Brasil',
        email: 'ric@ric.com.br',
        password_hash: 'b3u12b31%123h123#@!#U%djdksajd',
    });
    return res.json(user);
});

export default routes;