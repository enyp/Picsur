import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  ImageDeleteRequest,
  ImageDeleteResponse,
  ImageDeleteWithKeyRequest,
  ImageDeleteWithKeyResponse,
  ImageListRequest,
  ImageListResponse,
  ImageUploadResponse,
} from 'picsur-shared/dist/dto/api/image-manage.dto';
import { Permission } from 'picsur-shared/dist/dto/permissions.enum';
import { HasFailed, ThrowIfFailed } from 'picsur-shared/dist/types';
import { MultiPart } from '../../decorators/multipart/multipart.decorator';
import {
  HasPermission,
  RequiredPermissions,
} from '../../decorators/permissions.decorator';
import { ReqUserID } from '../../decorators/request-user.decorator';
import { Returns } from '../../decorators/returns.decorator';
import { ImageManagerService } from '../../managers/image/image.service';
import { ImageUploadDto } from '../../models/dto/image-upload.dto';
@Controller('api/image')
@RequiredPermissions(Permission.ImageUpload)
export class ImageManageController {
  private readonly logger = new Logger(ImageManageController.name);

  constructor(private readonly imagesService: ImageManagerService) {}

  @Post('upload')
  @Returns(ImageUploadResponse)
  async uploadImage(
    @MultiPart() multipart: ImageUploadDto,
    @ReqUserID() userid: string,
    @HasPermission(Permission.ImageDeleteKey) withDeleteKey: boolean,
  ): Promise<ImageUploadResponse> {
    const image = ThrowIfFailed(
      await this.imagesService.upload(
        userid,
        multipart.image.filename,
        multipart.image.buffer,
        withDeleteKey,
      ),
    );

    return image;
  }

  @Post('list')
  @RequiredPermissions(Permission.ImageManage)
  @Returns(ImageListResponse)
  async listMyImagesPaged(
    @Body() body: ImageListRequest,
    @ReqUserID() userid: string,
    @HasPermission(Permission.ImageAdmin) isImageAdmin: boolean,
  ): Promise<ImageListResponse> {
    if (!isImageAdmin) {
      body.user_id = userid;
    }

    const found = ThrowIfFailed(
      await this.imagesService.findMany(body.count, body.page, body.user_id),
    );

    return found;
  }

  @Post('delete')
  @RequiredPermissions(Permission.ImageManage)
  @Returns(ImageDeleteResponse)
  async deleteImage(
    @Body() body: ImageDeleteRequest,
    @ReqUserID() userid: string,
    @HasPermission(Permission.ImageAdmin) isImageAdmin: boolean,
  ): Promise<ImageDeleteResponse> {
    const deletedImages = ThrowIfFailed(
      await this.imagesService.deleteMany(
        body.ids,
        isImageAdmin ? undefined : userid,
      ),
    );

    return {
      images: deletedImages,
    };
  }

  @Post('delete/key')
  @RequiredPermissions(Permission.ImageDeleteKey)
  @Returns(ImageDeleteWithKeyResponse)
  async deleteImageWithKeyGet(
    @Body() body: ImageDeleteWithKeyRequest,
  ): Promise<ImageDeleteWithKeyResponse> {
    return ThrowIfFailed(
      await this.imagesService.deleteWithKey(body.id, body.key),
    );
  }

  @Get('delete/:id/:key')
  @RequiredPermissions(Permission.ImageDeleteKey)
  async deleteImageWithKeyPost(
    @Param() params: ImageDeleteWithKeyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<string> {
    const image = await this.imagesService.deleteWithKey(params.id, params.key);
    if (HasFailed(image)) {
      res.header('Location', '/error/delete-failure');
      res.code(302);
      return 'Failed to delete image';
    }

    res.header('Location', '/error/delete-success');
    res.code(302);
    return 'Successsfully deleted image';
  }
}
