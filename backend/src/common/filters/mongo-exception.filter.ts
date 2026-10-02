import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Error as MongooseError } from 'mongoose';

/**
 * Mongoose/MongoDB xatolarini 500 o'rniga tushunarli HTTP javobga aylantiradi:
 *  - noto'g'ri ID (CastError)              -> 400
 *  - sxema validatsiyasi (ValidationError) -> 400
 *  - unikal indeks buzilishi (E11000)      -> 409
 * Qolgan barcha xatolar Nest'ning standart filtriga uzatiladi.
 */
@Catch()
export class MongoExceptionFilter extends BaseExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    if (host.getType() !== 'http') return super.catch(exception, host);
    const res = host.switchToHttp().getResponse();

    if (exception instanceof MongooseError.CastError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Noto'g'ri qiymat: ${exception.path}`,
        error: 'Bad Request',
      });
    }
    if (exception instanceof MongooseError.ValidationError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: Object.values(exception.errors)
          .map((e) => e.message)
          .join(', '),
        error: 'Bad Request',
      });
    }
    if (exception?.code === 11000) {
      return res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Bunday yozuv allaqachon mavjud',
        error: 'Conflict',
      });
    }
    return super.catch(exception, host);
  }
}
