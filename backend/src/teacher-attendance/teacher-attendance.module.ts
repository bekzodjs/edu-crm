import { Controller, Get, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TeacherAttendance, TeacherLiveLocation, Teacher } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, teacherScope } from '../common/utils/access';

@Injectable()
export class TeacherAttendanceService {
  constructor(
    @InjectModel(TeacherAttendance.name) private taModel: Model<TeacherAttendance>,
    @InjectModel(TeacherLiveLocation.name) private liveModel: Model<TeacherLiveLocation>,
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
  ) {}

  async list(query: { teacherId?: string; from?: string; to?: string }) {
    const where: any = {};
    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.from || query.to) {
      where.capturedAt = {};
      if (query.from) where.capturedAt.$gte = new Date(query.from);
      if (query.to) where.capturedAt.$lte = new Date(query.to);
    }
    const records = await this.taModel.find(where).sort({ capturedAt: -1 }).limit(300);
    const teacherIds = [...new Set(records.map((r) => r.teacherId))];
    const teachers = teacherIds.length ? await this.teacherModel.find({ _id: { $in: teacherIds } }) : [];
    const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
    return records.map((r) => ({ ...r.toObject(), teacher: teacherMap.get(r.teacherId) || null }));
  }

  /** O'qituvchilarning hozirgi (jonli) joylashuv holati */
  async live(teacherId?: string) {
    const locations = await this.liveModel.find(teacherId ? { teacherId } : {});
    const teacherIds = locations.map((l) => l.teacherId);
    const teachers = teacherIds.length ? await this.teacherModel.find({ _id: { $in: teacherIds } }) : [];
    const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
    return locations
      .map((l) => ({ ...l.toObject(), teacher: teacherMap.get(l.teacherId) || null }))
      .sort((a, b) => Number(b.active) - Number(a.active));
  }
}

// Joylashuv — shaxsiy ma'lumot: rahbariyat hammanikini ko'radi, TEACHER esa faqat o'zinikini.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teacher-attendance')
export class TeacherAttendanceController {
  constructor(private service: TeacherAttendanceService) {}

  @Get()
  list(@Query() query: { teacherId?: string; from?: string; to?: string }, @CurrentUser() user: AuthUser) {
    const scope = teacherScope(user);
    return this.service.list(scope ? { ...query, teacherId: scope } : query);
  }

  @Get('live')
  live(@CurrentUser() user: AuthUser) {
    return this.service.live(teacherScope(user));
  }
}

@Module({
  controllers: [TeacherAttendanceController],
  providers: [TeacherAttendanceService],
  exports: [TeacherAttendanceService],
})
export class TeacherAttendanceModule {}
