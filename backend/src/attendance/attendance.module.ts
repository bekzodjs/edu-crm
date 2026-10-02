import { Body, Controller, Get, Injectable, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, Lesson, Student, Group } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

export class MarkAttendanceItemDto {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note?: string;
  lateMinutes?: number;
}

export class MarkAttendanceDto {
  lessonId: string;
  entries: MarkAttendanceItemDto[];
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(Lesson.name) private lessonModel: Model<Lesson>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    private notifications: NotificationsService,
  ) {}

  async markBulk(dto: MarkAttendanceDto) {
    const lesson = await this.lessonModel.findById(dto.lessonId);
    const group = lesson ? await this.groupModel.findById(lesson.groupId) : null;
    const results = [];

    for (const entry of dto.entries) {
      const record = await this.attendanceModel.findOneAndUpdate(
        { lessonId: dto.lessonId, studentId: entry.studentId },
        {
          status: entry.status,
          note: entry.note,
          markedAt: new Date(),
          lateMinutes: entry.status === 'LATE' ? entry.lateMinutes ?? undefined : undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      results.push(record);

      if (entry.status === 'ABSENT' || entry.status === 'LATE') {
        const student = await this.studentModel.findById(entry.studentId);
        const dateStr = lesson ? lesson.date.toISOString().slice(0, 10) : '';
        const lateText = entry.status === 'LATE' && entry.lateMinutes ? ` (${entry.lateMinutes} minut)` : '';
        const message =
          entry.status === 'ABSENT'
            ? `Assalomu alaykum! Farzandingiz ${student?.fullName} ${dateStr} sanadagi darsga kelmadi.`
            : `Assalomu alaykum! Farzandingiz ${student?.fullName} ${dateStr} sanadagi darsga kechikib keldi${lateText}.`;
        await this.notifications.notifyStudentParents(
          entry.studentId,
          entry.status === 'ABSENT' ? 'ABSENCE' : 'LATE',
          message,
        );
      }

      if (entry.status === 'PRESENT' && lesson && group) {
        await this.notifications.requestLessonFeedback(entry.studentId, group.teacherId, group.id, dto.lessonId);
      }
    }

    if (lesson) {
      lesson.status = 'COMPLETED';
      await lesson.save();
    }

    return results;
  }

  findByLesson(lessonId: string) {
    return this.attendanceModel.find({ lessonId });
  }

  findByStudent(studentId: string) {
    return this.attendanceModel.find({ studentId }).sort({ markedAt: -1 });
  }

  async report(query: { from?: string; to?: string; groupId?: string }) {
    const lessonFilter: any = {};
    if (query.groupId) lessonFilter.groupId = query.groupId;
    if (query.from || query.to) {
      lessonFilter.date = {};
      if (query.from) lessonFilter.date.$gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setDate(to.getDate() + 1);
        lessonFilter.date.$lt = to;
      }
    }

    const lessons = await this.lessonModel.find(lessonFilter);
    const lessonIds = lessons.map((l) => l.id);

    const attendances = lessonIds.length
      ? await this.attendanceModel.find({ lessonId: { $in: lessonIds } })
      : [];

    const byStudent = new Map<
      string,
      { present: number; absent: number; late: number; excused: number; lateMinutesTotal: number }
    >();
    for (const a of attendances) {
      const entry = byStudent.get(a.studentId) || { present: 0, absent: 0, late: 0, excused: 0, lateMinutesTotal: 0 };
      if (a.status === 'PRESENT') entry.present++;
      else if (a.status === 'ABSENT') entry.absent++;
      else if (a.status === 'LATE') {
        entry.late++;
        entry.lateMinutesTotal += a.lateMinutes || 0;
      } else if (a.status === 'EXCUSED') entry.excused++;
      byStudent.set(a.studentId, entry);
    }

    const studentIds = [...byStudent.keys()];
    const students = studentIds.length ? await this.studentModel.find({ _id: { $in: studentIds } }) : [];
    const studentMap = new Map(students.map((s) => [s.id, s]));

    return studentIds
      .map((studentId) => {
        const counts = byStudent.get(studentId)!;
        const student = studentMap.get(studentId);
        return {
          studentId,
          fullName: student?.fullName || "Noma'lum",
          parentPhone: student?.parentPhone,
          ...counts,
        };
      })
      .sort((a, b) => b.absent - a.absent || b.late - a.late);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  @Post()
  markBulk(@Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markBulk(dto);
  }

  @Get('lesson/:lessonId')
  findByLesson(@Param('lessonId') lessonId: string) {
    return this.attendanceService.findByLesson(lessonId);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.attendanceService.findByStudent(studentId);
  }

  @Get('report')
  report(@Query('from') from?: string, @Query('to') to?: string, @Query('groupId') groupId?: string) {
    return this.attendanceService.report({ from, to, groupId });
  }
}

@Module({
  imports: [TelegramModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
