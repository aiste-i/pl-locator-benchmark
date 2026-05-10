import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { UserService } from '../../../core/auth/services/user.service';
import { User } from '../../../core/auth/user.model';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { Comment } from '../models/comment.model';
import { AsyncPipe, DatePipe } from '@angular/common';
import { DefaultImagePipe } from '../../../shared/pipes/default-image.pipe';

@Component({
  selector: 'app-article-comment',
  template: `
    @if (comment) {
      <div data-testid="comment-card">
        <div class="card" [attr.data-testid]="'comment-card-' + comment.id">
          <div class="card-block" data-testid="comment-block">
            <p class="card-text" data-testid="comment-text">
              {{ comment.body }}
            </p>
          </div>
          <div class="card-footer" data-testid="comment-footer">
            <a class="comment-author" [routerLink]="['/profile', comment.author.username]" data-testid="comment-author-link">
              <img [src]="comment.author.image | defaultImage" class="comment-author-img" data-testid="comment-author-img" />
            </a>
            &nbsp;
            <a class="comment-author" [routerLink]="['/profile', comment.author.username]" data-testid="comment-author-name">
              {{ comment.author.username }}
            </a>
            <span class="date-posted" data-testid="comment-date">
              {{ comment.createdAt | date: 'longDate' }}
            </span>
            @if (canModify$ | async) {
              <span class="mod-options" data-testid="comment-mod-options">
                <button
                  type="button"
                  class="btn btn-link p-0"
                  aria-label="Delete comment"
                  (click)="delete.emit(true)"
                  data-testid="comment-delete-button"
                >
                  <i class="ion-trash-a"></i>
                </button>
              </span>
            }
          </div>
        </div>
      </div>
    }
  `,
  imports: [RouterLink, DatePipe, AsyncPipe, DefaultImagePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleCommentComponent {
  @Input() comment!: Comment;
  @Output() delete = new EventEmitter<boolean>();

  canModify$ = inject(UserService).currentUser.pipe(
    map((userData: User | null) => userData?.username === this.comment.author.username),
  );
}
