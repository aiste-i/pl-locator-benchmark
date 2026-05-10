import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Article } from '../models/article.model';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DefaultImagePipe } from '../../../shared/pipes/default-image.pipe';

@Component({
  selector: 'app-article-meta',
  template: `
    <div class="article-meta" data-testid="article-meta">
      <a [routerLink]="['/profile', article.author.username]" data-testid="article-author-link">
        <img [src]="article.author.image | defaultImage" data-testid="article-author-img" />
      </a>

      <div class="info" data-testid="article-info">
        <a class="author" [routerLink]="['/profile', article.author.username]" data-testid="article-author-name">
          {{ article.author.username }}
        </a>
        <span class="date" data-testid="article-date">
          {{ article.createdAt | date: 'longDate' }}
        </span>
      </div>

      <ng-content></ng-content>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DefaultImagePipe],
})
export class ArticleMetaComponent {
  @Input() article!: Article;
}
