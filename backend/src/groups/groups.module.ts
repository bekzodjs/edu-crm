import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, Teacher, Student, ScheduleSlot } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

export class CreateGroupDto {
  name: string;
  subject?: string;
  price: number;
  capacity?: number;
  teacherId: string;
  room?: string;
  salaryPct?: number;
}

export class UpdateGroupDto {
  name?: string;
  subject?: string;
  price?: number;
  capacity?: number;
  teacherId?: string;
  room?: string;
  active?: boolean;
  salaryPct?: number | null;
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(ScheduleSlot.name) private scheduleSlotModel: Model<ScheduleSlot>,
  ) {}

  create(dto: CreateGroupDto) {
    return this.groupModel.create({
      name: dto.name,
      subject: dto.subject,
      price: dto.price,
      capacity: dto.capacity ?? 20,
      teacherId: dto.teacherId,
      room: dto.room,
      salaryPct: dto.salaryPct,
      studentIds: [],
    });
  }

  findAll(teacherId?: string) {
    const where: any = {};
    if (teacherId) where.teacherId = teacherId;
    return this.groupModel.find(where).sort({ name: 1 });
  }

  async findOne(id: string) {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Guruh topilmadi');
    const teacher = await this.teacherModel.findById(group.teacherId);
    const students = group.studentIds.length
      ? await this.studentModel.find({ _id: { $in: group.studentIds } })
      : [];
    const scheduleSlots = await this.scheduleSlotModel.find({ groupId: id });
    return { ...group.toObject(), teacher, students, scheduleSlots };
  }

  async update(id: string, dto: UpdateGroupDto) {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Guruh topilmadi');
    const { salaryPct, ...rest } = dto;
    Object.assign(group, rest);
    if (salaryPct === null) group.salaryPct = undefined;
    else if (salaryPct !== undefined) group.salaryPct = salaryPct;
    await group.save();
    return group;
  }

  async remove(id: string) {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (group.studentIds.length) {
      await this.studentModel.updateMany(
        { _id: { $in: group.studentIds } },
        { $pull: { groupIds: id } },
      );
    }
    await group.deleteOne();
    return group;
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Roles('SUPERADMIN', 'ADMIN')
  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  findAll(@CurrentUser() currentUser: { role: string; teacherId?: string }) {
    const teacherId = currentUser.role === 'TEACHER' ? currentUser.teacherId : undefined;
    return this.groupsService.findAll(teacherId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: { role: string; teacherId?: string }) {
    const group = await this.groupsService.findOne(id);
    if (currentUser.role === 'TEACHER' && group.teacherId !== currentUser.teacherId) {
      throw new ForbiddenException("Faqat o'zingizning guruhingizni ko'rishingiz mumkin");
    }
    return group;
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.groupsService.remove(id);
  }
}

@Module({
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
