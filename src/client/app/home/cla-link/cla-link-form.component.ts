import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import {
  GithubCacheService,
  GithubRepo,
  GithubOrg,
  Gist
} from '../../shared/github';
import {
  LinkedRepo,
  LinkedOrg
} from '../../shared/claBackend';
import { HomeService } from '../home.service';
import { AuthService } from '../../login/auth.service';
import { DropdownComponent } from './dropdown.component';
import { InfoModal } from './info.modal';
import { ConfirmAddModal } from './confirm-add.modal';


import { Observable } from 'rxjs/Observable';


interface Link {
  selectedGist: Gist;
  selectedRepoOrOrg: GithubRepo | GithubOrg;
}

@Component({
  selector: 'cla-link-form',
  directives: [DropdownComponent, InfoModal, ConfirmAddModal],
  templateUrl: './cla-link-form.component.html'
})
export class ClaLinkFormComponent {
  @Input() public isUserOrgAdmin: boolean;
  @Output() public onClose: EventEmitter<void>;
  @Output() public onLink: EventEmitter<Link>;
  @ViewChild('gistDropdown')
  public gistsDropdown: DropdownComponent;
  @ViewChild('repoOrgDropdown')
  public repoOrgDropdown: DropdownComponent;
  @ViewChild(ConfirmAddModal)
  public confirmAddModal: ConfirmAddModal;

  private selectedGist: Gist;
  private selectedRepoOrOrg: GithubRepo | GithubOrg;

  constructor(
    private githubCacheService: GithubCacheService,
    private homeService: HomeService,
    private authService: AuthService
  ) {
    this.onClose = new EventEmitter<void>();
    this.onLink = new EventEmitter<Link>();
    this.clearSelectedGist();
  }

  public clear() {
    this.gistsDropdown.clear();
    this.repoOrgDropdown.clear();
    this.clearSelectedGist();
  }

  public link() {
    this.confirmAddModal.open().subscribe(
      confirmed => confirmed && this.confirmAddClosed()
    );
  }
  public confirmAddClosed() {
    this.onLink.emit({
      selectedGist: this.selectedGist,
      selectedRepoOrOrg: this.selectedRepoOrOrg
    });
    this.clear();
  }

  public getGistCategories() {
    return [
      {
        title: 'Default CLAs',
        items: this.getDefaultClas(),
        getItemText: (item: Gist) => item.fileName
      },
      {
        title: 'My Gist Files',
        items: this.getGistFiles(),
        getItemText: (item: Gist) => item.fileName
      }
    ];
  }
  public getDefaultClas() {
    return this.githubCacheService.getDefaultGists();
  }
  public getGistFiles() {
    return this.githubCacheService.getCurrentUserGists();
  }

  public getRepoOrgCategories() {
    const categories: any = [
      {
        title: 'Repositories',
        items: this.getGithubRepos(),
        getItemText: (item: GithubRepo) => item.fullName
      }
    ];
    if (this.isUserOrgAdmin) {
      categories.unshift({
        title: 'Organizations',
        items: this.getGithubOrgs(),
        getItemText: (item: GithubOrg) => item.login
      });
    }
    return categories;
  }

  public getGithubRepos() {
    return this.githubCacheService.getCurrentUserRepos()
      .combineLatest(this.homeService.getLinkedRepos(), (ghRepos: GithubRepo[], claRepos: LinkedRepo[]) => {
        return ghRepos.filter(ghRepo => !claRepos.some(claRepo => claRepo.id === ghRepo.id.toString()));
      });
  }
  public getGithubOrgs() {
    return this.githubCacheService.getCurrentUserOrgs()
      .combineLatest(this.homeService.getLinkedOrgs(), (ghOrgs: GithubOrg[], claOrgs: LinkedOrg[]) => {
        return ghOrgs.filter(ghOrg => !claOrgs.some(claOrg => claOrg.id === ghOrg.id.toString()));
      });
  }


  public handleGistSelected(event) {
    if (event) {
      this.selectedGist = event;
    } else {
      this.clearSelectedGist();
    }
  }

  public handleRepoOrOrgSelected(event) {
    this.selectedRepoOrOrg = event;
  }

  public info() {
    console.log('Not implemented');
  }

  public addScope() {
    this.authService.doLogin(true, true);
  }

  public validateInput() {
    const urlRegEx = /https:\/\/gist\.github\.com\/([a-zA-Z0-9_-]*)/;
    return this.selectedRepoOrOrg && urlRegEx.test(this.selectedGist.url);
  }

  private clearSelectedGist() {
    this.selectedGist = {
      fileName: null,
      url: '',
      updatedAt: '',
      history: []
    };
  }
}