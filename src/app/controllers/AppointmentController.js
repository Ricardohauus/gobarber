import Appointment from '../models/Appointment';
import * as Yup from 'yup';
import User from '../models/User';
import File from '../models/File';
import pt from 'date-fns/locale/pt';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import Notification from '../schemas/Notification';
import Queue from '../../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';

class AppointmentController {
    async index(req, res) {
        const { page = 1 } = req.query;
        const appointments = await Appointment.findAll({
            where: { user_id: req.userId, canceled_at: null },
            order: ['date'],
            attributes: ['id', 'date'],
            limit: 20,
            offset: (page - 1) * 20,
            include: [{
                model: User,
                as: 'provider',
                attributes: ['id', 'name'],
                include: [{
                    model: File,
                    as: 'avatar',
                    attributes: ['id', 'url', 'path'],
                }, ],
            }, ],
        });
        return res.json(appointments);
    }

    async store(req, res) {
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            date: Yup.date().required(),
        });

        if (!(await schema.isValid(req.body)))
            return res.status(400).json({ error: 'Erro na validação dos campos!' });

        const { provider_id, date } = req.body;

        const isProvider = await User.findOne({
            where: { id: provider_id, provider: true },
        });

        if (!isProvider)
            return res
                .status(401)
                .json({
                    error: 'Você não pode criar agendamentos para este usuário, pois ele não é um prestador de serviços',
                });

        if (provider_id == req.userId)
            return res
                .status(401)
                .json({ error: 'Você não pode criar agendamentos para você mesmo!' });

        const hourStart = startOfHour(parseISO(date));

        if (isBefore(hourStart, new Date())) {
            return res
                .status(400)
                .json({ error: 'Horários no passado não são permitidos!' });
        }

        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourStart,
            },
        });

        if (checkAvailability) {
            return res.status(400).json({ error: 'Horário não disponivel!' });
        }

        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            date,
        });

        const user = await User.findByPk(req.userId);
        const formattedDate = format(hourStart, "'dia' dd 'de' MMMM',às' H:mm'h'", {
            locale: pt,
        });
        Notification.create({
            content: `Novo agendamento de ${user.name} para o dia ${formattedDate}`,
            user: provider_id,
        });

        return res.json(appointment);
    }
    async delete(req, res) {
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [{
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'email'],
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name'],
                },
            ],
        });
        if (appointment.user_id !== req.userId) {
            return res
                .status(401)
                .json({ error: 'Você não tem permissão para cancelar o agendamento' });
        }
        const dateWithSub = subHours(appointment.date, 2);
        if (isBefore(dateWithSub, new Date())) {
            return res.status(401).json({
                error: 'Você não pode cancelar o agendamento pois o horario limite expirou!',
            });
        }
        appointment.canceled_at = new Date();

        await appointment.save();

        await Queue.add(CancellationMail.key, {
            appointment,
        });

        return res.json(appointment);
    }
}

export default new AppointmentController();
