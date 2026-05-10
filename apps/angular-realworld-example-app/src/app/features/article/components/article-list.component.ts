import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { ArticlesService } from '../services/articles.service';
import { ArticleListConfig } from '../models/article-list-config.model';
import { Article } from '../models/article.model';
import { ArticlePreviewComponent } from './article-preview.component';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoadingState } from '../../../core/models/loading-state.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-article-list',
  template: `
    @if (loading() === LoadingState.LOADING) {
      <div class="article-preview" data-testid="article-loading">Loading articles...</div>
    }

    @if (loading() === LoadingState.LOADED) {
      <div class="article-list" data-testid="article-list">
        @for (article of results(); track article.slug; let index = $index) {
          <app-article-preview [articleInput]="article" [previewIndex]="index + 1" data-testid="article-preview" />
        } @empty {
          <div class="article-preview empty-feed-message" data-testid="article-list-empty">
            @if (isFollowingFeed) {
              Your feed is empty. Follow some users to see their articles here, or check out the
              <a routerLink="/" data-testid="global-feed-link">Global Feed</a>!
            } @else {
              No articles are here... yet.
            }
          </div>
        }
      </div>

      <nav data-testid="pagination-nav">
        <ul class="pagination" data-testid="pagination-list">
          @for (pageNumber of totalPages(); track pageNumber) {
            <li
              class="page-item"
              [ngClass]="{ active: pageNumber === page() }"
              [attr.aria-label]="'Page ' + pageNumber"
              [attr.data-testid]="'pagination-item-' + pageNumber"
            >
              <button
                class="page-link"
                [attr.aria-label]="'Go to page ' + pageNumber"
                [attr.data-testid]="'pagination-link-' + pageNumber"
                (click)="setPageTo(pageNumber)"
              >
                {{ pageNumber }}
              </button>
            </li>
          }
        </ul>
      </nav>
    }
  `,
  imports: [ArticlePreviewComponent, NgClass, RouterLink],
  styles: `
    .page-link {
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleListComponent implements OnChanges {
  query!: ArticleListConfig;
  results = signal<Article[]>([]);
  page = signal(1);
  totalPages = signal<number[]>([]);
  loading = signal(LoadingState.NOT_LOADED);
  LoadingState = LoadingState;
  destroyRef = inject(DestroyRef);

  @Input() limit!: number;
  @Input() config!: ArticleListConfig;
  @Input() currentPage = 1;
  @Input() isFollowingFeed = false;
  @Output() pageChange = new EventEmitter<number>();

  ngOnChanges(changes: SimpleChanges): void {
    const configChange = changes['config'];
    const pageChange = changes['currentPage'];

    if (configChange?.currentValue) {
      this.query = configChange.currentValue;
      // Only reset page if currentPage wasn't also provided in this change
      if (!pageChange?.currentValue) {
        this.page.set(1);
      }
    }

    if (pageChange?.currentValue) {
      this.page.set(pageChange.currentValue);
    }

    // Run query if we have a config and either config or page changed
    if (this.query && (configChange || pageChange)) {
      this.runQuery();
    }
  }

  constructor(private articlesService: ArticlesService) {}

  setPageTo(pageNumber: number) {
    if (pageNumber !== this.page()) {
      this.page.set(pageNumber);
      this.pageChange.emit(pageNumber);
      this.runQuery();
    }
  }

  runQuery() {
    this.loading.set(LoadingState.LOADING);
    this.results.set([]);

    // Create limit and offset filter (if necessary)
    if (this.limit) {
      this.query.filters.limit = this.limit;
      this.query.filters.offset = this.limit * (this.page() - 1);
    }

    this.articlesService
      .query(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.loading.set(LoadingState.LOADED);
        this.results.set(data.articles);

        // Used from http://www.jstips.co/en/create-range-0...n-easily-using-one-line/
        this.totalPages.set(
          Array.from(new Array(Math.ceil(data.articlesCount / this.limit)), (val, index) => index + 1),
        );
      });
  }
}
