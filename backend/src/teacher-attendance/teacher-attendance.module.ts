import { Controller, Get, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TeacherAttendance, TeacherLiveLocation, Teacher } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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

  async live() {
    const locations = await this.liveModel.find();
    const teacherIds = locations.map((l) => l.teacherId);
    const teachers = teacherIds.length ? await this.teacherModel.find({ _id: { $in: teacherIds } }) : [];
    const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
    return locations
      .map((l) => ({ ...l.toObject(), teacher: teacherMap.get(l.teacherId) || null }))
      .sort((a, b) => Number(b.active) - Number(a.active));
  }
}

@UseGuards(JwtAuthGuard)
@Controller('teacher-attendance')
export class TeacherAttendanceController {
  constructor(private service: TeacherAttendanceService) {}

  @Get()
  list(@Query() query: { teacherId?: string; from?: string; to?: string }) {
    return this.service.list(query);
  }

  @Get('live')
  live() {
    return this.service.live();
  }
}

@Module({
  controllers: [TeacherAttendanceController],
  providers: [TeacherAttendanceService],
  exports: [TeacherAttendanceService],
})
export class TeacherAttendanceModule {}
