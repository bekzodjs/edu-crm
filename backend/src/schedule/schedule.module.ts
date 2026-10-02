import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScheduleSlot, Lesson, Group, Student, Attendance } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

// ---------- DTO ----------
export class CreateSlotDto {
  groupId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // "15:00"
  endTime: string; // "16:30"
  room?: string;
}

export class GenerateLessonsDto {
  groupId?: string; // bo'sh bo'lsa — barcha guruhlar
  fromDate: string; // "2026-09-01"
  toDate: string; // "2026-09-30"
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

  createSlot(dto: CreateSlotDto) {
    return this.slotModel.create(dto);
  }

  findSlots(groupId?: string) {
    return this.slotModel.find(groupId ? { groupId } : {}).sort({ dayOfWeek: 1 });
  }

  removeSlot(id: string) {
    return this.slotModel.findByIdAndDelete(id);
  }

  /** Berilgan sana oralig'ida haftalik jadval asosida aniq darslar (Lesson) yaratadi. */
  async generateLessons(dto: GenerateLessonsDto) {
    const slots = await this.slotModel.find(dto.groupId ? { groupId: dto.groupId } : {});

    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    const created: any[] = [];

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
      for (const slot of daySlots) {
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const existing = await this.lessonModel.findOne({
          groupId: slot.groupId,
          date: dateOnly,
          startTime: slot.startTime,
        });
        if (existing) continue;

        const lesson = await this.lessonModel.create({
          groupId: slot.groupId,
          date: dateOnly,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'PLANNED',
        });
        created.push(lesson);
      }
    }
    return { createdCount: created.length, lessons: created };
  }

  findLessons(query: { groupId?: string; from?: string; to?: string }) {
    const where: any = {};
    if (query.groupId) where.groupId = query.groupId;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.$gte = new Date(query.from);
      if (query.to) where.date.$lte = new Date(query.to);
    }
    return this.lessonModel.find(where).sort({ date: 1 });
  }

  async findLesson(id: string) {
    const lesson = await this.lessonModel.findById(id);
    if (!lesson) return null;
    const group = await this.groupModel.findById(lesson.groupId);
    const students = group?.studentIds.length
      ? await this.studentModel.find({ _id: { $in: group.studentIds } })
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
  findSlots(@Query('groupId') groupId?: string) {
    return this.scheduleService.findSlots(groupId);
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
  findLessons(@Query() query: { groupId?: string; from?: string; to?: string }) {
    return this.scheduleService.findLessons(query);
  }

  @Get('lessons/:id')
  findLesson(@Param('id') id: string) {
    return this.scheduleService.findLesson(id);
  }
}

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
