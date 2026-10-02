import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ScheduleSlot, Lesson, Group, Student, Attendance } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, loadGroupForUser, teacherGroupIds, teacherScope } from '../common/utils/access';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// Bir martada generatsiya qilinadigan eng uzun oraliq (tasodifan yillar bo'yi darslar
// yaratib yuborish va serverni band qilib qo'yishning oldini olish uchun).
const MAX_GENERATE_DAYS = 366;

// ---------- DTO ----------
export class CreateSlotDto {
  @IsString()
  @IsNotEmpty({ message: 'Guruh tanlanishi shart' })
  groupId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0-6 (0 = Yakshanba)

  @Matches(TIME_PATTERN, { message: "Boshlanish vaqti HH:MM formatida bo'lishi kerak" })
  startTime: string; // "15:00"

  @Matches(TIME_PATTERN, { message: "Tugash vaqti HH:MM formatida bo'lishi kerak" })
  endTime: string; // "16:30"

  @IsOptional() @IsString() @MaxLength(50) room?: string;
}

export class GenerateLessonsDto {
  @IsOptional() @IsString() groupId?: string; // bo'sh bo'lsa — barcha guruhlar

  @IsDateString({}, { message: "Boshlanish sanasi noto'g'ri" })
  fromDate: string; // "2026-09-01"

  @IsDateString({}, { message: "Tugash sanasi noto'g'ri" })
  toDate: string; // "2026-09-30"
}

/** "YYYY-MM-DD" ni mahalliy vaqt bo'yicha kun boshiga aylantiradi (UTC siljishisiz). */
function parseLocalDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(ScheduleSlot.name) private slotModel: Model<ScheduleSlot>,
    @InjectModel(Lesson.name) private lessonModel: Model<Lesson>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
  ) {}

  async createSlot(dto: CreateSlotDto) {
    await loadGroupForUser(this.groupModel, dto.groupId);
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak");
    }
    return this.slotModel.create(dto);
  }

  async findSlots(groupId: string | undefined, user: AuthUser) {
    const where: any = {};
    const scope = teacherScope(user);
    if (scope) {
      const ids = await teacherGroupIds(this.groupModel, scope);
      where.groupId = groupId ? (ids.includes(groupId) ? groupId : '__none__') : { $in: ids };
    } else if (groupId) {
      where.groupId = groupId;
    }
    return this.slotModel.find(where).sort({ dayOfWeek: 1, startTime: 1 });
  }

  async removeSlot(id: string) {
    const slot = await this.slotModel.findByIdAndDelete(id);
    if (!slot) throw new NotFoundException('Jadval topilmadi');
    return slot;
  }

  /** Berilgan sana oralig'ida haftalik jadval asosida aniq darslar (Lesson) yaratadi. */
  async generateLessons(dto: GenerateLessonsDto) {
    const from = parseLocalDate(dto.fromDate);
    const to = parseLocalDate(dto.toDate);
    if (to < from) throw new BadRequestException("Tugash sanasi boshlanish sanasidan oldin bo'lmasligi kerak");
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days > MAX_GENERATE_DAYS) {
      throw new BadRequestException(`Bir martada eng ko'pi bilan ${MAX_GENERATE_DAYS} kunlik dars yaratish mumkin`);
    }

    // Faqat mavjud va faol guruhlarning jadvali bo'yicha dars yaratiladi.
    const activeGroups = await this.groupModel
      .find(dto.groupId ? { _id: dto.groupId, active: true } : { active: true })
      .select('_id');
    const activeIds = activeGroups.map((g) => g.id);
    const slots = await this.slotModel.find({ groupId: { $in: activeIds } });

    // Oraliqdagi mavjud darslarni bitta so'rovda olib, takrorlanishni xotirada tekshiramiz.
    const toExclusive = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
    const existing = await this.lessonModel
      .find({ groupId: { $in: activeIds }, date: { $gte: from, $lt: toExclusive } })
      .select('groupId date startTime');
    const existingKeys = new Set(existing.map((l) => `${l.groupId}|${l.date.getTime()}|${l.startTime}`));

    const toCreate: any[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      for (const slot of slots) {
        if (slot.dayOfWeek !== d.getDay()) continue;
        const key = `${slot.groupId}|${dateOnly.getTime()}|${slot.startTime}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        toCreate.push({
          groupId: slot.groupId,
          date: dateOnly,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'PLANNED',
        });
      }
    }

    const created = toCreate.length ? await this.lessonModel.insertMany(toCreate) : [];
    return { createdCount: created.length, lessons: created };
  }

  async findLessons(query: { groupId?: string; from?: string; to?: string }, user: AuthUser) {
    const where: any = {};
    const scope = teacherScope(user);
    if (scope) {
      const ids = await teacherGroupIds(this.groupModel, scope);
      where.groupId = query.groupId ? (ids.includes(query.groupId) ? query.groupId : '__none__') : { $in: ids };
    } else if (query.groupId) {
      where.groupId = query.groupId;
    }
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.$gte = parseLocalDate(query.from);
      if (query.to) {
        // 'to' sanasi ham to'liq kiradi (kun oxirigacha).
        const to = parseLocalDate(query.to);
        where.date.$lt = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
      }
    }
    return this.lessonModel.find(where).sort({ date: 1, startTime: 1 });
  }

  async findLesson(id: string, user: AuthUser) {
    const lesson = await this.lessonModel.findById(id);
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const group = await loadGroupForUser(this.groupModel, lesson.groupId, user);
    const students = group.studentIds.length
      ? await this.studentModel.find({ _id: { $in: group.studentIds } }).sort({ fullName: 1 })
      : [];
    const attendances = await this.attendanceModel.find({ lessonId: id });
    return { ...lesson.toObject(), group, students, attendances };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private scheduleService: ScheduleService) {}

  @Roles('SUPERADMIN', 'ADMIN')
  @Post('slots')
  createSlot(@Body() dto: CreateSlotDto) {
    return this.scheduleService.createSlot(dto);
  }

  @Get('slots')
  findSlots(@Query('groupId') groupId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.scheduleService.findSlots(groupId, user);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Delete('slots/:id')
  removeSlot(@Param('id') id: string) {
    return this.scheduleService.removeSlot(id);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Post('lessons/generate')
  generateLessons(@Body() dto: GenerateLessonsDto) {
    return this.scheduleService.generateLessons(dto);
  }

  @Get('lessons')
  findLessons(@Query() query: { groupId?: string; from?: string; to?: string }, @CurrentUser() user: AuthUser) {
    return this.scheduleService.findLessons(query, user);
  }

  @Get('lessons/:id')
  findLesson(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.scheduleService.findLesson(id, user);
  }
}

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
