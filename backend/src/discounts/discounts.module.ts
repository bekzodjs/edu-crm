import { Controller, Injectable, Logger, Module, Post, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Grade, Group, Student } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

const TOP_STUDENT_COUNT = 5;
const TOP_STUDENT_DISCOUNT_PCT = 10;

@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);

  constructor(
    @InjectModel(Grade.name) private gradeModel: Model<Grade>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
  ) {}

  @Cron('0 0 1 * *')
  async handleMonthlyTopDiscounts() {
    this.logger.log('Oylik top-5 chegirmalarni hisoblash boshlandi...');
    await this.applyMonthlyTopDiscounts();
  }

  async applyMonthlyTopDiscounts() {
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const groups = await this.groupModel.find({ active: true });
    const topStudentIds = new Set<string>();

    for (const group of groups) {
      if (!group.studentIds.length) continue;

      const grades = await this.gradeModel.find({
        groupId: group.id,
        studentId: { $in: group.studentIds },
        createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd },
      });
      if (!grades.length) continue;

      const byStudent = new Map<string, { sum: number; count: number }>();
      for (const g of grades) {
        const entry = byStudent.get(g.studentId) || { sum: 0, count: 0 };
        entry.sum += g.score;
        entry.count += 1;
        byStudent.set(g.studentId, entry);
      }

      const ranked = [...byStudent.entries()]
        .map(([studentId, { sum, count }]) => ({ studentId, average: sum / count }))
        .sort((a, b) => b.average - a.average)
        .slice(0, TOP_STUDENT_COUNT);

      ranked.forEach((r) => topStudentIds.add(r.studentId));
    }

    const idsArray = [...topStudentIds];
    if (idsArray.length) {
      await this.studentModel.updateMany({ _id: { $in: idsArray } }, { discountPct: TOP_STUDENT_DISCOUNT_PCT });
    }
    await this.studentModel.updateMany({ _id: { $nin: idsArray } }, { discountPct: 0 });

    this.logger.log(
      `Chegirma yangilandi: ${idsArray.length} ta o'quvchiga ${TOP_STUDENT_DISCOUNT_PCT}% chegirma berildi.`,
    );
    return { discountedCount: idsArray.length, discountPct: TOP_STUDENT_DISCOUNT_PCT };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN')
@Controller('discounts')
export class DiscountsController {
  constructor(private discountsService: DiscountsService) {}

  @Post('run-monthly')
  run() {
    return this.discountsService.applyMonthlyTopDiscounts();
  }
}

@Module({
  controllers: [DiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
