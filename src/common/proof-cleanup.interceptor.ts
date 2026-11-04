import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';
import { removeStoredFile, toStoredPath } from './proof-upload.util';

/**
 * Hapus file bukti bayar dari disk kalau request gagal sebelum sampai
 * service (mis. validasi DTO ditolak ValidationPipe, atau guard memblokir).
 * Service sudah membersihkan file sendiri saat transaksi rollback, jadi
 * fungsi ini hanya menutup celah error di luar controller.
 */
@Injectable()
export class ProofCleanupInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ file?: Express.Multer.File }>();

    return next.handle().pipe(
      catchError((err: unknown) => {
        if (req?.file) {
          removeStoredFile(toStoredPath(req.file));
        }
        return throwError(() => err);
      }),
    );
  }
}
