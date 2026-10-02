import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StudentLeaveRequest, Student, Group } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

export class DecideStudentLeaveRequestDto {
  note?: string;
}

@Injectable()
export class StudentLeaveRequestsService {
  constructor(
    @InjectModel(StudentLeaveRequest.name) private leaveModel: Model<StudentLeaveRequest>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    private notifications: NotificationsService,
  ) {}

  // TEACHER faqat o'zi dars beradigan guruhlardagi o'quvchilarning ota-onalari
  // yuborgan arizalarini ko'rishi kerak — boshqa guruhlarnikini emas.
  async list(
    query: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; studentId?: string },
    teacherId?: string,
  ) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.studentId) where.studentId = query.studentId;

    if (teacherId) {
      const teacherGroups = await this.groupModel.find({ teacherId }).select('studentIds');
      const studentIdSet = new Set<string>();
      for (const g of teacherGroups) for (const sId of g.studentIds) studentIdSet.add(sId);
      if (query.studentId) {
        where.studentId = studentIdSet.has(query.studentId) ? query.studentId : '__none__';
      } else {
        where.studentId = { $in: [...studentIdSet] };
      }
    }

    const requests = await this.leaveModel.find(where).sort({ createdAt: -1 });
    const studentIds = [...new Set(requests.map((r) => r.studentId))];
    const students = studentIds.length ? await this.studentModel.find({ _id: { $in: studentIds } }) : [];
    const studentMap = new Map(students.map((s) => [s.id, s] as const));
    return requests.map((r) => ({ ...r.toObject(), student: studentMap.get(r.studentId) || null }));
  }

  async approve(id: string, note?: string) {
    return this.decide(id, 'APPROVED', note);
  }

  async reject(id: string, note?: string) {
    return this.decide(id, 'REJECTED', note);
  }

  private async decide(id: string, status: 'APPROVED' | 'REJECTED', note?: string) {
    const request = await this.leaveModel.findById(id);
    if (!request) throw new NotFoundException('Ariza topilmadi');

    request.status = status;
    request.decidedAt = new Date();
    request.decidedNote = note;
    await request.save();

    const student = await this.studentModel.findById(request.studentId);
    const label = status === 'APPROVED' ? '✅ Arizangiz tasdiqlandi.' : '❌ Arizangiz rad etildi.';
    const noteText = note ? `\nIzoh: ${note}` : '';
    await this.notifications.notifyStudentParents(
      request.studentId,
      'STUDENT_LEAVE_DECISION',
      `${label}${noteText}\n\nAriza: "${request.reason}"`,
    );

    return { ...request.toObject(), student };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('student-leave-requests')
export class StudentLeaveRequestsController {
  constructor(private service: StudentLeaveRequestsService) {}

  @Get()
  list(
    @Query() query: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; studentId?: string },
    @CurrentUser() currentUser: { role: string; teacherId?: string },
  ) {
    const teacherId = currentUser.role === 'TEACHER' ? currentUser.teacherId : undefined;
    return this.service.list(query, teacherId);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: DecideStudentLeaveRequestDto) {
    return this.service.approve(id, dto.note);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() dto: DecideStudentLeaveRequestDto) {
    return this.service.reject(id, dto.note);
  }
}

@Module({
  imports: [TelegramModule],
  controllers: [StudentLeaveRequestsController],
  providers: [StudentLeaveRequestsService],
  exports: [StudentLeaveRequestsService],
})
export class StudentLeaveRequestsModule {}
