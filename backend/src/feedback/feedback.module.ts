import { Controller, ForbiddenException, Get, Injectable, Module, Param, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Feedback } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

export interface FeedbackListQuery {
  teacherId?: string;
  studentId?: string;
  groupId?: string;
}

@Injectable()
export class FeedbackService {
  constructor(@InjectModel(Feedback.name) private feedbackModel: Model<Feedback>) {}

  list(query: FeedbackListQuery) {
    const where: any = {};
    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.studentId) where.studentId = query.studentId;
    if (query.groupId) where.groupId = query.groupId;
    return this.feedbackModel.find(where).sort({ createdAt: -1 }).limit(200);
  }

  async summaryForTeacher(teacherId: string) {
    const [positive, negative, recent] = await Promise.all([
      this.feedbackModel.countDocuments({ teacherId, sentiment: 'POSITIVE' }),
      this.feedbackModel.countDocuments({ teacherId, sentiment: 'NEGATIVE' }),
      this.feedbackModel.find({ teacherId }).sort({ createdAt: -1 }).limit(30),
    ]);
    return { positive, negative, total: positive + negative, recent };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Get()
  list(@Query() query: FeedbackListQuery, @CurrentUser() currentUser: { role: string; teacherId?: string }) {
    if (currentUser.role === 'TEACHER') {
      if (query.teacherId && query.teacherId !== currentUser.teacherId) {
        throw new ForbiddenException("Faqat o'zingizning fikr-mulohazalaringizni ko'rishingiz mumkin");
      }
      return this.feedbackService.list({ ...query, teacherId: currentUser.teacherId });
    }
    return this.feedbackService.list(query);
  }

  @Get('summary/:teacherId')
  summary(
    @Param('teacherId') teacherId: string,
    @CurrentUser() currentUser: { role: string; teacherId?: string },
  ) {
    if (currentUser.role === 'TEACHER' && currentUser.teacherId !== teacherId) {
      throw new ForbiddenException("Faqat o'zingizning fikr-mulohazalaringizni ko'rishingiz mumkin");
    }
    return this.feedbackService.summaryForTeacher(teacherId);
  }
}

@Module({
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
