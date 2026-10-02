import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, Student, Group, Teacher } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

const PAYMENT_METHODS = ['CASH', 'CARD', 'PAYME', 'CLICK', 'OTHER'] as const;
export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty({ message: "O'quvchi tanlanishi shart" })
  studentId: string;

  @IsNumber({}, { message: "Summa son bo'lishi kerak" })
  @Min(1, { message: "Summa musbat bo'lishi kerak" })
  @Max(1_000_000_000)
  amount: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS, { message: "To'lov usuli noto'g'ri" })
  method?: (typeof PAYMENT_METHODS)[number];

  @Matches(PERIOD_PATTERN, { message: "Oy YYYY-MM formatida bo'lishi kerak" })
  periodMonth: string; // "2026-09"

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export interface PaymentListQuery {
  studentId?: string;
  periodMonth?: string;
  method?: string;
  page?: string;
  limit?: string;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreatePaymentDto) {
    const student = await this.studentModel.findById(dto.studentId);
    if (!student) throw new NotFoundException('O‘quvchi topilmadi');

    const payment = await this.paymentModel.create({
      studentId: dto.studentId,
      amount: dto.amount,
      method: dto.method || 'CASH',
      periodMonth: dto.periodMonth,
      note: dto.note,
    });

    await this.notifications.notifyStudentParents(
      dto.studentId,
      'PAYMENT_RECEIVED',
      `✅ ${student.fullName} uchun ${dto.periodMonth} oyi bo'yicha ${dto.amount.toLocaleString()} so'm to'lov qabul qilindi. Rahmat!`,
    );

    return payment;
  }

  async findAll(query: PaymentListQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 30));

    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.periodMonth) where.periodMonth = query.periodMonth;
    if (query.method) where.method = query.method;

    const [data, total] = await Promise.all([
      this.paymentModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.paymentModel.countDocuments(where),
    ]);

    return { data, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) };
  }

  findByStudent(studentId: string) {
    return this.paymentModel.find({ studentId }).sort({ createdAt: -1 });
  }

  /**
   * Berilgan oy uchun har bir o'qituvchining "daromadi"ni hisoblaydi.
   * Bitta to'lov bir nechta guruhga (agar o'quvchi bir necha guruhda bo'lsa) narx nisbatiga
   * qarab taqsimlanadi, so'ng har bir guruh narxining ulushi shu guruh o'qituvchisiga tegishli
   * "yig'ilgan summa"ga qo'shiladi. Daromad = yig'ilgan summa * o'qituvchining maosh foizi.
   */
  async teacherEarnings(period?: string) {
    if (period && !PERIOD_PATTERN.test(period)) throw new BadRequestException("Oy YYYY-MM formatida bo'lishi kerak");
    const targetPeriod = period || currentPeriod();

    const [teachers, groups, students, payments] = await Promise.all([
      this.teacherModel.find(),
      this.groupModel.find({ active: true }),
      this.studentModel.find(),
      this.paymentModel.find({ periodMonth: targetPeriod }),
    ]);

    const teacherMap = new Map(teachers.map((t) => [t.id, t]));
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const grossByTeacher = new Map<string, number>();
    // Bitta o'qituvchi bir nechta fan/guruhda turlicha maosh foizida ishlashi mumkin
    // (masalan matematikadan 40%, IT'dan 50%) — shu sababli daromad har bir guruh
    // o'zining (yoki, agar guruhda alohida belgilanmagan bo'lsa, o'qituvchining
    // standart) foizi bo'yicha alohida hisoblanadi, so'ng o'qituvchi bo'yicha yig'iladi.
    const earningByTeacher = new Map<string, number>();

    for (const payment of payments) {
      const student = studentMap.get(payment.studentId);
      if (!student) continue;
      const activeGroups = (student.groupIds || [])
        .map((id) => groupMap.get(id))
        .filter((g) => !!g) as Group[];
      const totalPrice = activeGroups.reduce((sum, g) => sum + (g.price || 0), 0);
      if (!activeGroups.length || totalPrice === 0) continue;

      for (const g of activeGroups) {
        const weight = (g.price || 0) / totalPrice;
        const share = payment.amount * weight;
        grossByTeacher.set(g.teacherId, (grossByTeacher.get(g.teacherId) || 0) + share);

        const teacher = teacherMap.get(g.teacherId);
        const pct = g.salaryPct ?? teacher?.salaryPct ?? 0;
        const earned = (share * pct) / 100;
        earningByTeacher.set(g.teacherId, (earningByTeacher.get(g.teacherId) || 0) + earned);
      }
    }

    const rows = teachers.map((t) => {
      const gross = Math.round(grossByTeacher.get(t.id) || 0);
      const earning = Math.round(earningByTeacher.get(t.id) || 0);
      // Jadvalda ko'rsatiladigan "% " — agar o'qituvchining barcha guruhlari bir xil
      // foizda bo'lsa, aynan o'sha foiz; aks holda daromaddan qaytarib chiqarilgan
      // o'rtacha (effektiv) foiz ko'rsatiladi.
      const teacherGroups = groups.filter((g) => g.teacherId === t.id);
      const distinctPcts = new Set(teacherGroups.map((g) => g.salaryPct ?? t.salaryPct ?? 0));
      const salaryPct =
        distinctPcts.size <= 1
          ? [...distinctPcts][0] ?? t.salaryPct ?? 0
          : gross > 0
          ? Math.round((earning / gross) * 1000) / 10
          : t.salaryPct || 0;
      const groupCount = teacherGroups.length;
      const studentCount = teacherGroups.reduce((sum, g) => sum + (g.studentIds?.length || 0), 0);
      return {
        teacherId: t.id,
        fullName: t.fullName,
        salaryPct,
        mixedPct: distinctPcts.size > 1,
        gross,
        earning,
        groupCount,
        studentCount,
      };
    });

    rows.sort((a, b) => b.earning - a.earning);
    return { period: targetPeriod, rows, totalEarning: rows.reduce((s, r) => s + r.earning, 0) };
  }

  /** Bitta o'qituvchi o'zining daromadi va guruhlari statistikasini ko'rishi uchun (oylar bo'yicha tarix). */
  async teacherEarningsHistory(teacherId: string, months = 6) {
    months = Math.min(24, Math.max(1, Math.floor(months) || 6));
    const now = new Date();
    const periods: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const history = await Promise.all(
      periods.map(async (p) => {
        const { rows } = await this.teacherEarnings(p);
        const row = rows.find((r) => r.teacherId === teacherId);
        return {
          period: p,
          gross: row?.gross || 0,
          earning: row?.earning || 0,
          groupCount: row?.groupCount || 0,
          studentCount: row?.studentCount || 0,
        };
      }),
    );
    return history.reverse();
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Roles('SUPERADMIN', 'ADMIN')
  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  // TEACHER uchun umumiy to'lovlar/daromad hisobotlari butunlay yopiq — u o'zining
  // daromadini "Mening profilim" sahifasidan (teacher-earnings/history) ko'radi.
  @Roles('SUPERADMIN', 'ADMIN', 'RAHBAR')
  @Get()
  findAll(@Query() query: PaymentListQuery) {
    return this.paymentsService.findAll(query);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Get('teacher-earnings')
  teacherEarnings(@Query('period') period?: string) {
    return this.paymentsService.teacherEarnings(period);
  }

  @Get('teacher-earnings/:teacherId/history')
  teacherEarningsHistory(
    @Param('teacherId') teacherId: string,
    @Query('months') months: string | undefined,
    @CurrentUser() currentUser: { role: string; teacherId?: string },
  ) {
    if (currentUser.role === 'TEACHER' && currentUser.teacherId !== teacherId) {
      throw new ForbiddenException("Faqat o'zingizning ma'lumotlaringizni ko'rishingiz mumkin");
    }
    return this.paymentsService.teacherEarningsHistory(teacherId, months ? Number(months) : undefined);
  }

  @Roles('SUPERADMIN', 'ADMIN', 'RAHBAR')
  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.paymentsService.findByStudent(studentId);
  }
}

@Module({
  imports: [TelegramModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
