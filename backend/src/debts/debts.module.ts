import { BadRequestException, Controller, Get, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, Group, Payment } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class DebtsService {
  constructor(
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
  ) {}

  /** Berilgan oy (YYYY-MM) uchun barcha faol o'quvchilarning qarzdorligini hisoblaydi. */
  async getDebtsForPeriod(period?: string) {
    if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException("Oy YYYY-MM formatida bo'lishi kerak");
    }
    const targetPeriod = period || currentPeriod();
    const [students, groups, paidRows] = await Promise.all([
      this.studentModel.find({ active: true }),
      this.groupModel.find(),
      // Har bir o'quvchi uchun alohida so'rov (N+1) o'rniga — bitta agregatsiya.
      this.paymentModel.aggregate<{ _id: string; total: number }>([
        { $match: { periodMonth: targetPeriod } },
        { $group: { _id: '$studentId', total: { $sum: '$amount' } } },
      ]),
    ]);
    const groupMap = new Map(groups.map((g) => [g.id, g] as const));
    const paidMap = new Map(paidRows.map((r) => [r._id, r.total] as const));

    const result: any[] = [];
    for (const student of students) {
      const fullPrice = student.groupIds.reduce((sum, gId) => {
        const g = groupMap.get(gId);
        return sum + (g?.active ? g.price : 0);
      }, 0);
      if (fullPrice === 0) continue;

      // Oldingi oyda guruhida eng top 5 ichiga kirgan o'quvchiga avtomatik chegirma qo'llanadi.
      const discountPct = student.discountPct || 0;
      const expected = Math.round(fullPrice * (1 - discountPct / 100));

      const paid = paidMap.get(student.id) || 0;
      const debt = expected - paid;

      if (debt > 0) {
        result.push({
          student: { id: student.id, fullName: student.fullName, parentPhone: student.parentPhone },
          period: targetPeriod,
          expected,
          paid,
          debt,
          discountPct,
        });
      }
    }

    return {
      period: targetPeriod,
      totalDebt: result.reduce((s, r) => s + r.debt, 0),
      debtorsCount: result.length,
      debtors: result.sort((a, b) => b.debt - a.debt),
    };
  }

  /** Bitta o'quvchi bo'yicha joriy oy qarzdorligi (Telegram bot uchun ham ishlatiladi) */
  async getStudentDebt(studentId: string, period?: string) {
    const targetPeriod = period || currentPeriod();
    const student = await this.studentModel.findById(studentId);
    if (!student) return null;
    const groups = student.groupIds.length
      ? await this.groupModel.find({ _id: { $in: student.groupIds } })
      : [];
    const fullPrice = groups.reduce((s, g) => s + (g.active ? g.price : 0), 0);
    const discountPct = student.discountPct || 0;
    const expected = Math.round(fullPrice * (1 - discountPct / 100));
    const payments = await this.paymentModel.find({ studentId, periodMonth: targetPeriod });
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    return { period: targetPeriod, expected, paid, debt: expected - paid, discountPct };
  }
}

// Qarzdorlik hisoboti ham "To'lovlar" bo'limining bir qismi — TEACHER uchun yopiq.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('debts')
export class DebtsController {
  constructor(private debtsService: DebtsService) {}

  @Roles('SUPERADMIN', 'ADMIN', 'RAHBAR')
  @Get()
  getDebts(@Query('period') period?: string) {
    return this.debtsService.getDebtsForPeriod(period);
  }
}

@Module({
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
