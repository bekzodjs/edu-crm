import {
  BadRequestException,
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
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { LeaveRequest, Teacher } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

export class DecideLeaveRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectModel(LeaveRequest.name) private leaveModel: Model<LeaveRequest>,
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
    private notifications: NotificationsService,
  ) {}

  async list(query: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; teacherId?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.teacherId) where.teacherId = query.teacherId;
    const requests = await this.leaveModel.find(where).sort({ createdAt: -1 });
    const teacherIds = [...new Set(requests.map((r) => r.teacherId))];
    const teachers = teacherIds.length ? await this.teacherModel.find({ _id: { $in: teacherIds } }) : [];
    const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
    return requests.map((r) => ({ ...r.toObject(), teacher: teacherMap.get(r.teacherId) || null }));
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
    // Qaror bir marta qabul qilinadi — aks holda qayta bosishda takroriy Telegram xabarlari ketardi.
    if (request.status !== 'PENDING') throw new BadRequestException("Bu ariza bo'yicha qaror allaqachon qabul qilingan");

    request.status = status;
    request.decidedAt = new Date();
    request.decidedNote = note;
    await request.save();

    const teacher = await this.teacherModel.findById(request.teacherId);
    const label = status === 'APPROVED' ? '✅ Arizangiz tasdiqlandi.' : '❌ Arizangiz rad etildi.';
    const noteText = note ? `\nIzoh: ${note}` : '';
    await this.notifications.notifyTeacher(
      request.teacherId,
      'LEAVE_DECISION',
      `${label}${noteText}\n\nSabab: "${request.reason}"`,
    );

    return { ...request.toObject(), teacher };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private service: LeaveRequestsService) {}

  // TEACHER faqat o'zining arizalarini ko'rishi kerak — boshqa o'qituvchilarning
  // arizalarini emas. Shuning uchun TEACHER uchun teacherId majburiy o'zinikiga
  // qat'iy belgilanadi (so'rovda boshqa teacherId yuborilgan bo'lsa ham inobatga olinmaydi).
  @Get()
  list(
    @Query() query: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; teacherId?: string },
    @CurrentUser() currentUser: { role: string; teacherId?: string },
  ) {
    const effectiveQuery =
      currentUser.role === 'TEACHER' ? { ...query, teacherId: currentUser.teacherId } : query;
    return this.service.list(effectiveQuery);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: DecideLeaveRequestDto) {
    return this.service.approve(id, dto.note);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() dto: DecideLeaveRequestDto) {
    return this.service.reject(id, dto.note);
  }
}

@Module({
  imports: [TelegramModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
