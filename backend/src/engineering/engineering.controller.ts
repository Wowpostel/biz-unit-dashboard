import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createReadStream } from 'fs';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { Public } from '../auth/public.decorator';
import { EngineeringService } from './engineering.service';
import { PartImagesService } from './part-images.service';
import { CreateSpecDto, LookupPartsDto, SaveSpecItemsDto, SaveTechOperationsDto } from './dto';

function uploadDir() {
  const dir = join(process.env.UPLOAD_DIR ?? './uploads', 'tech');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function partsInboxDir() {
  const dir = join(process.env.UPLOAD_DIR ?? './uploads', 'parts', 'inbox');
  mkdirSync(dir, { recursive: true });
  return dir;
}

@Controller()
export class EngineeringController {
  constructor(
    private readonly engineering: EngineeringService,
    private readonly partImages: PartImagesService,
  ) {}

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER)
  @Get('specs')
  list(@CurrentUser() user: AuthUser) {
    return this.engineering.listSpecs(user.tenantId);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER)
  @Get('specs/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engineering.getSpec(user.tenantId, id);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('specs')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpecDto) {
    return this.engineering.createSpec(user.tenantId, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Patch('specs/:id')
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSpecDto,
  ) {
    return this.engineering.patchSpec(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('parts/lookup')
  lookup(@CurrentUser() user: AuthUser, @Body() dto: LookupPartsDto) {
    return this.engineering.lookupParts(user.tenantId, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Put('specs/:id/items')
  saveItems(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveSpecItemsDto,
  ) {
    return this.engineering.saveItems(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Put('spec-items/:id/operations')
  saveOps(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveTechOperationsDto,
  ) {
    return this.engineering.saveOperations(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('tech-operations/:id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir()),
        filename: (_req, file, cb) => {
          const safe = file.originalname.replace(/[^\w.\-а-яА-ЯёЁ]+/g, '_');
          cb(null, `${Date.now()}-${safe}`);
        },
      }),
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  addImage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.engineering.addImage(user.tenantId, id, file);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER, Role.OPERATOR)
  @Get('tech-images/:id')
  async getImage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const img = await this.engineering.getImage(user.tenantId, id);
    res.setHeader('Content-Type', img.mimeType);
    createReadStream(img.storagePath).pipe(res);
  }

  /** Cookie-authenticated print/kiosk <img> fallback with unguessable id. */
  @Public()
  @Get('files/tech-images/:id')
  async publicImage(@Param('id') id: string, @Res() res: Response) {
    const img = await this.engineering.getImage(undefined, id);
    res.setHeader('Content-Type', img.mimeType);
    createReadStream(img.storagePath).pipe(res);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Delete('tech-images/:id')
  removeImage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engineering.removeImage(user.tenantId, id);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER, Role.OPERATOR)
  @Get('part-images')
  async listPartImages(@CurrentUser() user: AuthUser) {
    const items = await this.partImages.list(user.tenantId);
    return {
      inbox: this.partImages.inboxDir(),
      layout: 'uploads/parts/{tenant}/{номер}.ext',
      items,
    };
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('part-images/pack')
  @UseInterceptors(
    FilesInterceptor('files', 80, {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, partsInboxDir()),
        filename: (_req, file, cb) => {
          const safe = file.originalname.replace(/[^\w.\-а-яА-ЯёЁ]+/g, '_');
          cb(null, safe);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async packPartImages(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const code = await this.partImages.tenantCode(user.tenantId);
    return this.partImages.attachFiles(user.tenantId, code, files ?? []);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('part-images/ingest')
  async ingestPartImages(@CurrentUser() user: AuthUser) {
    const code = await this.partImages.tenantCode(user.tenantId);
    return this.partImages.ingestInbox(user.tenantId, code);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER, Role.OPERATOR)
  @Get('part-images/:id')
  async getPartImageFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const img = await this.partImages.get(user.tenantId, id);
    res.setHeader('Content-Type', img.mimeType);
    createReadStream(img.storagePath).pipe(res);
  }

  @Public()
  @Get('files/part-images/:id')
  async publicPartImage(@Param('id') id: string, @Res() res: Response) {
    const img = await this.partImages.get(undefined, id);
    res.setHeader('Content-Type', img.mimeType);
    createReadStream(img.storagePath).pipe(res);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Delete('part-images/:id')
  removePartImage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.partImages.remove(user.tenantId, id);
  }
}
