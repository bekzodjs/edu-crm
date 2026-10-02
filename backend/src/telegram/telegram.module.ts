import {
  Controller,
  forwardRef,
  Get,
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import TelegramBot from 'node-telegram-bot-api';
import { randomBytes } from 'crypto';
import {
  ParentLink,
  TeacherLink,
  Student,
  Teacher,
  Attendance,
  TeacherAttendance,
  TeacherLiveLocation,
  LeaveRequest,
  StudentLeaveRequest,
  NotificationLog,
  Feedback,
} from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DebtsModule, DebtsService } from '../debts/debts.module';
import { GradesModule, GradesService } from '../grades/grades.module';

type PendingTeacherAction = 'CHECK_IN' | 'CHECK_OUT';
type PendingLeaveKind = 'TEACHER' | 'PARENT';

interface PendingFeedback {
  studentId: string;
  teacherId: string;
  groupId: string;
  lessonId?: string;
  stage: 'SENTIMENT' | 'COMMENT';
  sentiment?: 'POSITIVE' | 'NEGATIVE';
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;

  private pendingTeacherAction = new Map<string, PendingTeacherAction>();
  private pendingLeaveRequest = new Map<string, PendingLeaveKind>();
  private pendingFeedback = new Map<string, PendingFeedback>();

  constructor(
    private config: ConfigService,
    @InjectModel(ParentLink.name) private parentLinkModel: Model<ParentLink>,
    @InjectModel(TeacherLink.name) private teacherLinkModel: Model<TeacherLink>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(TeacherAttendance.name) private teacherAttendanceModel: Model<TeacherAttendance>,
    @InjectModel(TeacherLiveLocation.name) private liveLocationModel: Model<TeacherLiveLocation>,
    @InjectModel(Feedback.name) private feedbackModel: Model<Feedback>,
    @InjectModel(LeaveRequest.name) private leaveRequestModel: Model<LeaveRequest>,
    @InjectModel(StudentLeaveRequest.name) private studentLeaveRequestModel: Model<StudentLeaveRequest>,
    private debtsService: DebtsService,
    @Inject(forwardRef(() => GradesService)) private gradesService: GradesService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('TELEGRAM_BOT_ENABLED') === 'true';
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');

    if (!enabled || !token) {
      this.logger.warn(
        'Telegram bot ishga tushirilmadi (TELEGRAM_BOT_ENABLED=false yoki TELEGRAM_BOT_TOKEN yo‘q). .env faylni to‘ldiring.',
      );
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.registerHandlers();
    this.logger.log('Telegram bot polling rejimida ishga tushdi.');
  }

  isEnabled() {
    return !!this.bot;
  }

  private registerHandlers() {
    if (!this.bot) return;
    const bot = this.bot;

    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
      const chatId = String(msg.chat.id);
      const code = match?.[1]?.trim();

      if (!code) {
        await bot.sendMessage(
          chatId,
          'Assalomu alaykum! Bu — o‘quv markazi bildirishnoma boti.\n' +
            'Bog‘lanish uchun administratordan olingan kodni yuboring.\n' +
            'Masalan: /start ABC123',
        );
        return;
      }

      const parentLink = await this.parentLinkModel.findOne({ linkCode: code });
      if (parentLink) {
        parentLink.chatId = chatId;
        parentLink.linkedAt = new Date();
        await parentLink.save();
        const student = await this.studentModel.findById(parentLink.studentId);
        await bot.sendMessage(
          chatId,
          `✅ Bog‘landingiz! Endi "${student?.fullName}" haqida bildirishnomalarni shu yerda olasiz.\n\n` +
            'Buyruqlar:\n' +
            '/qarz — joriy oy qarzdorligi\n' +
            '/davomat — so‘nggi darslar davomati\n' +
            '/baho — bu hafta/oy olgan baholari\n' +
            '/ariza — farzandingiz haqida ariza yuborish (masalan, darsga kela olmasligi haqida)',
        );
        return;
      }

      const teacherLink = await this.teacherLinkModel.findOne({ linkCode: code });
      if (teacherLink) {
        teacherLink.chatId = chatId;
        teacherLink.linkedAt = new Date();
        await teacherLink.save();
        const teacher = await this.teacherModel.findById(teacherLink.teacherId);
        await bot.sendMessage(
          chatId,
          `✅ Bog‘landingiz, ${teacher?.fullName}!\n\n` +
            'Buyruqlar:\n' +
            '/keldim — ishga kelganingizda joylashuv yuborib davomat belgilash\n' +
            '/ketyapman — ishdan ketayotganda joylashuv yuborish\n' +
            '/ariza — sabab ko‘rsatib ta’til/ruxsat so‘rash',
        );
        return;
      }

      await bot.sendMessage(chatId, 'Kod topilmadi yoki eskirgan. Administratordan yangi kod so‘rang.');
    });

    bot.onText(/\/qarz/, async (msg) => {
      const chatId = String(msg.chat.id);
      const links = await this.parentLinkModel.find({ chatId });
      if (!links.length) {
        await bot.sendMessage(chatId, 'Siz hali hech qaysi o‘quvchiga bog‘lanmagansiz. /start <kod> yuboring.');
        return;
      }
      let text = '';
      for (const link of links) {
        const student = await this.studentModel.findById(link.studentId);
        const debt = await this.debtsService.getStudentDebt(link.studentId);
        text += `👤 ${student?.fullName}\nOylik: ${debt?.expected?.toLocaleString()} so'm\nTo'langan: ${debt?.paid?.toLocaleString()} so'm\n`;
        text += debt && debt.debt > 0 ? `❗ Qarz: ${debt.debt.toLocaleString()} so'm\n\n` : `✅ Qarz yo‘q\n\n`;
      }
      await bot.sendMessage(chatId, text.trim());
    });

    bot.onText(/\/davomat/, async (msg) => {
      const chatId = String(msg.chat.id);
      const links = await this.parentLinkModel.find({ chatId });
      if (!links.length) {
        await bot.sendMessage(chatId, 'Siz hali hech qaysi o‘quvchiga bog‘lanmagansiz. /start <kod> yuboring.');
        return;
      }
      let text = '';
      for (const link of links) {
        const student = await this.studentModel.findById(link.studentId);
        const attendances = await this.attendanceModel
          .find({ studentId: link.studentId })
          .sort({ markedAt: -1 })
          .limit(5);
        text += `👤 ${student?.fullName}\n`;
        if (!attendances.length) text += 'Davomat ma\'lumoti yo‘q\n\n';
        for (const a of attendances) {
          const icon = a.status === 'PRESENT' ? '✅' : a.status === 'LATE' ? '⏰' : a.status === 'EXCUSED' ? '📄' : '❌';
          text += `${icon} ${a.markedAt.toISOString().slice(0, 10)} — ${a.status}\n`;
        }
        text += '\n';
      }
      await bot.sendMessage(chatId, text.trim());
    });

    bot.onText(/\/baho/, async (msg) => {
      const chatId = String(msg.chat.id);
      const links = await this.parentLinkModel.find({ chatId });
      if (!links.length) {
        await bot.sendMessage(chatId, 'Siz hali hech qaysi o‘quvchiga bog‘lanmagansiz. /start <kod> yuboring.');
        return;
      }
      let text = '';
      for (const link of links) {
        const student = await this.studentModel.findById(link.studentId);
        const summary = await this.gradesService.summaryForStudent(link.studentId);
        text += `\ud83c\udf93 ${student?.fullName}\n`;
        text += `\ud83d\udcc5 Bu hafta: ${summary.week.count} ta baho, o‘rtacha ${summary.week.average || 0}\n`;
        text += `\ud83d\udcc6 Bu oy: ${summary.month.count} ta baho, o‘rtacha ${summary.month.average || 0}\n`;
        if (summary.recent.length) {
          text += `So‘nggi baholar: ${summary.recent.slice(0, 5).map((g) => g.score).join(', ')}\n`;
        }
        text += '\n';
      }
      await bot.sendMessage(chatId, text.trim());
    });

    const askForLocation = async (chatId: string, prompt: string) => {
      await bot.sendMessage(chatId, prompt, {
        reply_markup: {
          keyboard: [[{ text: '📍 Joylashuvni yuborish', request_location: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
    };

    bot.onText(/\/keldim/, async (msg) => {
      const chatId = String(msg.chat.id);
      const link = await this.teacherLinkModel.findOne({ chatId });
      if (!link) {
        await bot.sendMessage(chatId, 'Bu buyruq faqat bog‘langan o‘qituvchilar uchun.');
        return;
      }
      this.pendingTeacherAction.set(chatId, 'CHECK_IN');
      await askForLocation(chatId, 'Ishga kelganingizni tasdiqlash uchun joylashuvingizni yuboring:');
    });

    bot.onText(/\/ketyapman/, async (msg) => {
      const chatId = String(msg.chat.id);
      const link = await this.teacherLinkModel.findOne({ chatId });
      if (!link) {
        await bot.sendMessage(chatId, 'Bu buyruq faqat bog‘langan o‘qituvchilar uchun.');
        return;
      }
      this.pendingTeacherAction.set(chatId, 'CHECK_OUT');
      await askForLocation(chatId, 'Ishdan ketayotganingizni tasdiqlash uchun joylashuvingizni yuboring:');
    });

    bot.on('location', async (msg) => {
      const chatId = String(msg.chat.id);
      const pending = this.pendingTeacherAction.get(chatId);
      if (!pending || !msg.location) return;

      const link = await this.teacherLinkModel.findOne({ chatId });
      if (!link) return;

      const { latitude, longitude } = msg.location;
      await this.teacherAttendanceModel.create({ teacherId: link.teacherId, type: pending, latitude, longitude });
      await this.liveLocationModel.findOneAndUpdate(
        { teacherId: link.teacherId },
        { latitude, longitude, active: pending === 'CHECK_IN' },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      this.pendingTeacherAction.delete(chatId);
      const label = pending === 'CHECK_IN' ? 'Ishga kelganingiz' : 'Ishdan ketganingiz';
      const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      await bot.sendMessage(chatId, `✅ ${label} qayd qilindi (${time}).`, {
        reply_markup: { remove_keyboard: true },
      });
    });

    bot.on('edited_message', async (msg) => {
      if (!msg.location) return;
      const chatId = String(msg.chat.id);
      const link = await this.teacherLinkModel.findOne({ chatId });
      if (!link) return;

      const live = await this.liveLocationModel.findOne({ teacherId: link.teacherId });
      if (!live || !live.active) return;

      live.latitude = msg.location.latitude;
      live.longitude = msg.location.longitude;
      await live.save();
    });

    bot.onText(/\/ariza(?:\s+([\s\S]+))?/, async (msg, match) => {
      const chatId = String(msg.chat.id);
      const reason = match?.[1]?.trim();

      const teacherLink = await this.teacherLinkModel.findOne({ chatId });
      if (teacherLink) {
        if (!reason) {
          this.pendingLeaveRequest.set(chatId, 'TEACHER');
          await bot.sendMessage(chatId, 'Ariza sababini yozib yuboring (masalan: "Bemorman, bugun kela olmayman").');
          return;
        }
        await this.submitTeacherLeaveRequest(teacherLink.teacherId, chatId, reason);
        return;
      }

      const parentLink = await this.parentLinkModel.findOne({ chatId });
      if (parentLink) {
        if (!reason) {
          this.pendingLeaveRequest.set(chatId, 'PARENT');
          await bot.sendMessage(
            chatId,
            'Farzandingiz haqidagi arizangizni yozib yuboring (masalan: "Bugun bemor, darsga kela olmaydi").',
          );
          return;
        }
        await this.submitStudentLeaveRequest(parentLink.studentId, chatId, reason);
        return;
      }

      await bot.sendMessage(chatId, 'Bu buyruqdan foydalanish uchun avval /start <kod> orqali bog‘laning.');
    });

    bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      const chatId = String(msg.chat.id);

      const feedback = this.pendingFeedback.get(chatId);
      if (feedback) {
        const text = msg.text.trim();

        if (feedback.stage === 'SENTIMENT') {
          let sentiment: 'POSITIVE' | 'NEGATIVE' | null = null;
          if (/ijobiy|\uD83D\uDC4D/i.test(text)) sentiment = 'POSITIVE';
          else if (/salbiy|\uD83D\uDC4E/i.test(text)) sentiment = 'NEGATIVE';

          if (!sentiment) {
            await bot.sendMessage(chatId, "Iltimos, quyidagi tugmalardan birini tanlang: \uD83D\uDC4D Ijobiy yoki \uD83D\uDC4E Salbiy.");
            return;
          }

          feedback.sentiment = sentiment;
          feedback.stage = 'COMMENT';
          this.pendingFeedback.set(chatId, feedback);
          await bot.sendMessage(chatId, "Izoh qoldirmoqchimisiz? Yozing, yoki \u201Cyo\u2018q\u201D deb javob bering.", {
            reply_markup: { remove_keyboard: true },
          });
          return;
        }

        this.pendingFeedback.delete(chatId);
        const noComment = /^(yo.?q\.?|-|skip)$/i.test(text);
        await this.feedbackModel.create({
          studentId: feedback.studentId,
          teacherId: feedback.teacherId,
          groupId: feedback.groupId,
          lessonId: feedback.lessonId,
          sentiment: feedback.sentiment,
          comment: noComment ? undefined : text,
        });
        await bot.sendMessage(chatId, "\u2705 Rahmat! Fikringiz qabul qilindi.");
        return;
      }

      const kind = this.pendingLeaveRequest.get(chatId);
      if (!kind) return;
      this.pendingLeaveRequest.delete(chatId);

      if (kind === 'TEACHER') {
        const link = await this.teacherLinkModel.findOne({ chatId });
        if (link) await this.submitTeacherLeaveRequest(link.teacherId, chatId, msg.text.trim());
      } else {
        const link = await this.parentLinkModel.findOne({ chatId });
        if (link) await this.submitStudentLeaveRequest(link.studentId, chatId, msg.text.trim());
      }
    });
  }

  async promptFeedback(
    chatId: string,
    ctx: { studentId: string; teacherId: string; groupId: string; lessonId?: string },
  ) {
    if (!this.bot) return;
    this.pendingFeedback.set(chatId, { ...ctx, stage: 'SENTIMENT' });
    await this.bot.sendMessage(chatId, "Bugungi dars qanday o'tdi?", {
      reply_markup: {
        keyboard: [[{ text: '\uD83D\uDC4D Ijobiy' }, { text: '\uD83D\uDC4E Salbiy' }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
  }

  private async submitTeacherLeaveRequest(teacherId: string, chatId: string, reason: string) {
    await this.leaveRequestModel.create({ teacherId, reason });
    await this.bot!.sendMessage(chatId, '✅ Arizangiz qabul qilindi. Administrator ko‘rib chiqib javob beradi.');
  }

  private async submitStudentLeaveRequest(studentId: string, chatId: string, reason: string) {
    await this.studentLeaveRequestModel.create({ studentId, reason });
    await this.bot!.sendMessage(chatId, '✅ Arizangiz qabul qilindi. Administrator ko‘rib chiqib javob beradi.');
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn(`Bot o'chirilgan, xabar yuborilmadi: ${text}`);
      return false;
    }
    try {
      await this.bot.sendMessage(chatId, text);
      return true;
    } catch (err) {
      this.logger.error(`Telegramga xabar yuborishda xato: ${err}`);
      return false;
    }
  }
}

@Injectable()
export class ParentLinkService {
  constructor(@InjectModel(ParentLink.name) private parentLinkModel: Model<ParentLink>) {}

  async createLinkCode(studentId: string) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    return this.parentLinkModel.create({ studentId, linkCode: code });
  }

  findByStudent(studentId: string) {
    return this.parentLinkModel.find({ studentId });
  }
}

@Injectable()
export class TeacherLinkService {
  constructor(@InjectModel(TeacherLink.name) private teacherLinkModel: Model<TeacherLink>) {}

  async createLinkCode(teacherId: string) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    return this.teacherLinkModel.create({ teacherId, linkCode: code });
  }

  findByTeacher(teacherId: string) {
    return this.teacherLinkModel.find({ teacherId });
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(ParentLink.name) private parentLinkModel: Model<ParentLink>,
    @InjectModel(TeacherLink.name) private teacherLinkModel: Model<TeacherLink>,
    @InjectModel(NotificationLog.name) private notificationLogModel: Model<NotificationLog>,
    private telegramService: TelegramService,
  ) {}

  async notifyStudentParents(studentId: string, type: string, message: string) {
    const links = await this.parentLinkModel.find({ studentId, chatId: { $ne: null } });
    for (const link of links) {
      const success = await this.telegramService.sendMessage(link.chatId!, message);
      await this.notificationLogModel.create({ studentId, chatId: link.chatId!, type, message, success });
    }
    return { sentTo: links.length };
  }

  async notifyTeacher(teacherId: string, type: string, message: string) {
    const links = await this.teacherLinkModel.find({ teacherId, chatId: { $ne: null } });
    for (const link of links) {
      const success = await this.telegramService.sendMessage(link.chatId!, message);
      await this.notificationLogModel.create({ teacherId, chatId: link.chatId!, type, message, success });
    }
    return { sentTo: links.length };
  }

  async requestLessonFeedback(studentId: string, teacherId: string, groupId: string, lessonId?: string) {
    const links = await this.parentLinkModel.find({ studentId, chatId: { $ne: null } });
    for (const link of links) {
      await this.telegramService.promptFeedback(link.chatId!, { studentId, teacherId, groupId, lessonId });
    }
    return { sentTo: links.length };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telegram')
export class TelegramController {
  constructor(
    private parentLinkService: ParentLinkService,
    private teacherLinkService: TeacherLinkService,
    private telegramService: TelegramService,
    @InjectModel(NotificationLog.name) private notificationLogModel: Model<NotificationLog>,
  ) {}

  @Roles('SUPERADMIN', 'ADMIN')
  @Post('link/:studentId')
  createLink(@Param('studentId') studentId: string) {
    return this.parentLinkService.createLinkCode(studentId);
  }

  @Get('link/:studentId')
  getLinks(@Param('studentId') studentId: string) {
    return this.parentLinkService.findByStudent(studentId);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Post('teacher-link/:teacherId')
  createTeacherLink(@Param('teacherId') teacherId: string) {
    return this.teacherLinkService.createLinkCode(teacherId);
  }

  @Get('teacher-link/:teacherId')
  getTeacherLinks(@Param('teacherId') teacherId: string) {
    return this.teacherLinkService.findByTeacher(teacherId);
  }

  @Get('status')
  status() {
    return { enabled: this.telegramService.isEnabled() };
  }

  @Get('logs/:studentId')
  logs(@Param('studentId') studentId: string) {
    return this.notificationLogModel.find({ studentId }).sort({ createdAt: -1 }).limit(50);
  }
}

@Module({
  imports: [ConfigModule, DebtsModule, forwardRef(() => GradesModule)],
  controllers: [TelegramController],
  providers: [TelegramService, ParentLinkService, TeacherLinkService, NotificationsService],
  exports: [TelegramService, ParentLinkService, TeacherLinkService, NotificationsService],
})
export class TelegramModule {}
